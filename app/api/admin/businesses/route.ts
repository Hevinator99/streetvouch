import { headers } from "next/headers";
import { adminAllowed, db, json, sameOrigin } from "../../_shared";
import { safeBusinessSlug } from "../../../../lib/onboarding";

export async function POST(request: Request) {
  const h = await headers();
  if (!adminAllowed(h) || !sameOrigin(request)) return json({ ok: false }, 403);
  const body = await request.json() as Record<string, unknown>;
  const name = String(body.name ?? "").trim().slice(0, 120);
  const slug = safeBusinessSlug(String(body.slug ?? name));
  const contactEmail = String(body.contactEmail ?? "").trim().toLowerCase().slice(0, 254);
  if (!name || !slug || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return json({ ok: false, message: "Business name and a valid contact email are required." }, 400);
  const database = db(), id = crypto.randomUUID(), now = new Date().toISOString();
  try {
    await database.batch([
      database.prepare(`INSERT INTO businesses (id,slug,name,google_review_url,owner_email,contact_email,logo_url,address,category,phone,website,opening_hours,google_profile_url,status,customer_heading,customer_intro,customer_private_prompt,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'setup',?,?,?,0,?,?)`).bind(id, slug, name, String(body.googleReviewUrl ?? ""), contactEmail, contactEmail, text(body.logoUrl), text(body.address), text(body.category), text(body.phone), text(body.website), text(body.openingHours), text(body.googleProfileUrl), text(body.customerHeading) ?? "How was your visit?", text(body.customerIntro) ?? "Share an honest review or send feedback privately.", text(body.customerPrivatePrompt) ?? "Something we should know?", now, now),
      database.prepare(`INSERT INTO onboarding_checks (business_id,updated_at) VALUES (?,?)`).bind(id, now),
      database.prepare(`INSERT INTO google_connections (id,business_id,status,created_at,updated_at) VALUES (?,?,'not_connected',?,?)`).bind(crypto.randomUUID(), id, now, now),
      database.prepare(`INSERT INTO audit_events (id,business_id,actor_email,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), id, h.get("oai-authenticated-user-email"), "business_created", "business", id, name, now),
    ]);
    return json({ ok: true, id, slug, message: "Business created. Continue the setup checklist." });
  } catch (error) {
    console.error("business_create_failed", error);
    return json({ ok: false, message: "That business could not be created. Check that the URL name is unique." }, 409);
  }
}

function text(value: unknown) { const result = String(value ?? "").trim(); return result ? result.slice(0, 2000) : null; }

export async function PATCH(request: Request) {
  const h = await headers();
  if (!adminAllowed(h) || !sameOrigin(request)) return json({ ok: false }, 403);
  const body = await request.json() as Record<string, unknown>, businessId = String(body.businessId ?? "");
  if (!businessId) return json({ ok: false }, 400);
  const now = new Date().toISOString(), database = db();
  const previous=await database.prepare("SELECT customer_heading,customer_intro,customer_private_prompt FROM businesses WHERE id=?").bind(businessId).first<{customer_heading:string;customer_intro:string;customer_private_prompt:string}>();
  if(!previous)return json({ok:false,message:"Business not found."},404);
  if(!text(body.name)||!String(body.contactEmail??"").match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))return json({ok:false,message:"Business name and valid contact email are required."},400);
  const wordingChanged=previous.customer_heading!==text(body.customerHeading)||previous.customer_intro!==text(body.customerIntro)||previous.customer_private_prompt!==text(body.customerPrivatePrompt);
  const publishCustomerPage=body.publishCustomerPage===true;
  const result = await database.prepare(`UPDATE businesses SET name=?,logo_url=?,address=?,category=?,contact_email=?,phone=?,website=?,opening_hours=?,google_profile_url=?,google_review_url=?,customer_heading=?,customer_intro=?,customer_private_prompt=?,updated_at=? WHERE id=?`).bind(text(body.name), text(body.logoUrl), text(body.address), text(body.category), text(body.contactEmail), text(body.phone), text(body.website), text(body.openingHours), text(body.googleProfileUrl), text(body.googleReviewUrl) ?? "", text(body.customerHeading) ?? "How was your visit?", text(body.customerIntro) ?? "Share an honest review or send feedback privately.", text(body.customerPrivatePrompt) ?? "Something we should know?", now, businessId).run();
  if (!result.meta.changes) return json({ ok: false }, 404);
  const complete = [body.name, body.address, body.category, body.contactEmail, body.phone, body.googleProfileUrl].every(value => Boolean(text(value)));
  await database.prepare(`INSERT INTO onboarding_checks (business_id,business_details_complete,updated_at) VALUES (?,?,?) ON CONFLICT(business_id) DO UPDATE SET business_details_complete=excluded.business_details_complete,updated_at=excluded.updated_at`).bind(businessId, complete ? 1 : 0, now).run();
  if(publishCustomerPage)await database.batch([database.prepare("UPDATE businesses SET page_approved=1,page_approved_at=?,status=CASE WHEN status='setup' THEN 'awaiting_approval' ELSE status END WHERE id=?").bind(now,businessId),database.prepare("UPDATE onboarding_checks SET customer_page_approved=1,updated_at=? WHERE business_id=?").bind(now,businessId)]);
  else if(wordingChanged)await database.batch([database.prepare("UPDATE businesses SET page_approved=0,page_approved_at=NULL WHERE id=?").bind(businessId),database.prepare("UPDATE onboarding_checks SET customer_page_approved=0,updated_at=? WHERE business_id=?").bind(now,businessId)]);
  await database.prepare("INSERT INTO audit_events (id,business_id,actor_email,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),businessId,h.get("oai-authenticated-user-email"),publishCustomerPage?"customer_page_published":"business_details_updated","business",businessId,publishCustomerPage?"StreetVouch published the customer-facing page":wordingChanged?"Customer wording changed; page returned to draft":"Business details updated",now).run();
  return json({ ok: true, complete, published:publishCustomerPage, message: publishCustomerPage ? "Business details saved and customer page published." : complete ? "Draft saved and business details marked complete." : "Draft saved. Required fields are still missing." });
}
