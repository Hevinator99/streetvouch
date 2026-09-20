import { headers } from "next/headers";
import { adminAllowed, db, json, sameOrigin } from "../../_shared";
import { canActivatePilot, type ActivationChecks } from "../../../../lib/onboarding";

const columns = new Set(["business_details_complete","manager_account_active","google_connection_tested","customer_page_approved","nfc_tested","qr_tested","private_feedback_tested","notification_email_tested"]);

export async function POST(request: Request) {
  const h = await headers();
  if (!adminAllowed(h) || !sameOrigin(request)) return json({ ok: false }, 403);
  const body = await request.json() as { businessId?: string; action?: string; check?: string; value?: boolean };
  if (!body.businessId) return json({ ok: false }, 400);
  const database = db(), now = new Date().toISOString();
  await database.prepare("INSERT OR IGNORE INTO onboarding_checks (business_id,updated_at) SELECT id,? FROM businesses WHERE id=?").bind(now,body.businessId).run();
  const audit=()=>database.prepare("INSERT INTO audit_events (id,business_id,actor_email,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),body.businessId,h.get("oai-authenticated-user-email"),"setup_"+body.action,"business",body.businessId,body.action==="check"?String(body.check)+": "+String(body.value):String(body.action),now).run();
  if (body.action === "check") {
    if (!body.check || !columns.has(body.check)) return json({ ok: false }, 400);
    if (["business_details_complete","manager_account_active","google_connection_tested","customer_page_approved"].includes(body.check)) return json({ok:false,message:"This check is verified from the business, owner or Google record."},409);
    await database.prepare(`UPDATE onboarding_checks SET ${body.check}=?,updated_at=? WHERE business_id=?`).bind(body.value ? 1 : 0, now, body.businessId).run();
    await audit();return json({ ok: true, message: "Checklist updated." });
  }
  const row = await database.prepare(`SELECT business_details_complete businessDetailsComplete,manager_account_active managerAccountActive,google_connection_tested googleConnectionTested,customer_page_approved customerPageApproved,nfc_tested nfcTested,qr_tested qrTested,private_feedback_tested privateFeedbackTested,notification_email_tested notificationEmailTested FROM onboarding_checks WHERE business_id=?`).bind(body.businessId).first<Record<string,number>>();
  if (!row) return json({ ok: false }, 404);
  const checks = Object.fromEntries(Object.entries(row).map(([key,value]) => [key, Boolean(value)])) as ActivationChecks;
  if (body.action === "activate") {
    const real=await database.prepare(`SELECT b.page_approved,b.name,b.address,b.category,b.contact_email,b.phone,b.google_profile_url,EXISTS(SELECT 1 FROM manager_users m WHERE m.business_id=b.id AND m.active=1) owner_active,EXISTS(SELECT 1 FROM google_connections g WHERE g.business_id=b.id AND g.status='connected' AND g.last_synced_at IS NOT NULL) google_ready,EXISTS(SELECT 1 FROM business_assets a WHERE a.business_id=b.id AND a.active=1) has_asset FROM businesses b WHERE b.id=?`).bind(body.businessId).first<Record<string,unknown>>();
    if(!real||!real.page_approved||!real.owner_active||!real.google_ready||!real.has_asset||![real.name,real.address,real.category,real.contact_email,real.phone,real.google_profile_url].every(Boolean))return json({ok:false,message:"Activation needs complete business details, a published customer page, an active owner account, tested Google connection and an active asset."},409);
    if (!canActivatePilot(checks)) return json({ ok: false, message: "Complete every required test before activating this pilot." }, 409);
    await database.batch([database.prepare("UPDATE businesses SET status='active',active=1,pilot_started_at=COALESCE(pilot_started_at,?),updated_at=? WHERE id=?").bind(now, now, body.businessId), database.prepare("UPDATE onboarding_checks SET pilot_activated=1,updated_at=? WHERE business_id=?").bind(now, body.businessId)]);
    await audit();return json({ ok: true, message: "Pilot activated." });
  }
  if (body.action === "pause") {
    const result = await database.prepare("UPDATE businesses SET status='paused',active=0,updated_at=? WHERE id=? AND status='active'").bind(now, body.businessId).run();
    if(result.meta.changes)await audit();return result.meta.changes ? json({ok:true,message:"Pilot paused."}) : json({ok:false,message:"Only an active pilot can be paused."},409);
  }
  if (body.action === "complete") {
    if (!canActivatePilot(checks)) return json({ok:false,message:"Incomplete onboarding cannot be marked complete."},409);
    const result = await database.prepare("UPDATE businesses SET status='completed',active=0,pilot_completed_at=?,onboarding_handoff_at=COALESCE(onboarding_handoff_at,?),updated_at=? WHERE id=? AND status IN ('active','paused')").bind(now, now, now, body.businessId).run();
    if(result.meta.changes)await audit();return result.meta.changes ? json({ok:true,message:"Pilot completed and handed off."}) : json({ok:false,message:"Activate the pilot before completing the handoff."},409);
  }
  return json({ ok: false }, 400);
}
