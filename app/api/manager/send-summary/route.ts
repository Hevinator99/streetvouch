import { env } from "cloudflare:workers";
import { getManagerSession } from "../../../manager-auth";
import { db, json, sameOrigin } from "../../_shared";

const escapeHtml=(value:string)=>value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");

export async function POST(request:Request){
  const session=await getManagerSession();
  if(!session||!sameOrigin(request))return json({ok:false},403);
  if(!env.RESEND_API_KEY)return json({ok:false,message:"Email delivery is unavailable."},503);
  const database=db(),now=new Date(),periodEnd=now.toISOString(),since=new Date(now.getTime()-7*86400000).toISOString();
  const [events,feedback,reviews]=await Promise.all([
    database.prepare("SELECT event_type,COUNT(*) count FROM events WHERE business_id=? AND created_at>=? GROUP BY event_type").bind(session.businessId,since).all<{event_type:string;count:number}>(),
    database.prepare("SELECT status,severity,contact_requested,message FROM feedback WHERE business_id=? AND created_at>=? ORDER BY created_at DESC").bind(session.businessId,since).all<{status:string;severity:string;contact_requested:number;message:string}>(),
    database.prepare("SELECT COUNT(*) count,AVG(rating) average FROM google_reviews WHERE business_id=? AND google_created_at>=?").bind(session.businessId,since).first<{count:number;average:number}>()
  ]);
  const counts=Object.fromEntries(events.results.map(r=>[r.event_type,r.count])),items=feedback.results,flagged=items.filter(x=>x.severity!=="normal"),waiting=items.filter(x=>x.contact_requested&&x.status!=="resolved");
  const snapshot=JSON.stringify({pageVisits:counts.page_view??0,googleClicks:counts.google_click??0,privateMessages:items.length,newGoogleReviews:reviews?.count??0,averageGoogleRating:reviews?.average??null,flagged:flagged.length,awaitingContact:waiting.length});
  const html=`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:32px;color:#142829"><div style="font-weight:800;font-size:20px">✓ streetvouch</div><p style="letter-spacing:.12em;font-size:12px;font-weight:700;margin-top:32px">VILLAGE BARBERS COBHAM · WEEKLY PULSE</p><h1 style="font-family:Georgia,serif;font-size:38px">Your customers, made clear.</h1><table style="width:100%;border-collapse:collapse"><tr><td style="padding:14px;background:#f0f5f1"><b>${counts.page_view??0}</b><br>page visits</td><td style="padding:14px;background:#f0f5f1"><b>${counts.google_click??0}</b><br>Google clicks</td><td style="padding:14px;background:#f0f5f1"><b>${items.length}</b><br>private messages</td><td style="padding:14px;background:#f0f5f1"><b>${reviews?.count??0}</b><br>new reviews</td></tr></table><p style="font-size:12px;color:#617170">Google clicks and new reviews are shown separately; a review may have been left without using StreetVouch.</p><h2 style="margin-top:28px">What needs attention</h2><p>${flagged.length} item(s) flagged · ${waiting.length} customer(s) awaiting contact.</p><h2>Recent feedback</h2>${items.slice(0,5).map(x=>`<p style="border-left:3px solid #c7ff5e;padding-left:12px">${escapeHtml(x.message)}</p>`).join("")||"<p>No private feedback this week.</p>"}<p style="margin-top:28px"><a href="https://go.streetvouch.com/manager/village-barbers-cobham" style="background:#142829;color:#fff;text-decoration:none;padding:13px 18px;border-radius:9px;font-weight:700">Open manager dashboard</a></p></div>`;
  try{
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:env.EMAIL_FROM??"StreetVouch <onboarding@resend.dev>",to:[session.email],subject:"Your Village Barbers customer pulse",html})});
    if(!response.ok)throw new Error(`Email service returned ${response.status}`);
    await database.batch([
      database.prepare("INSERT INTO report_deliveries (id,business_id,recipient_email,status,period_start,period_end,snapshot,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),session.businessId,session.email,"sent",since,periodEnd,snapshot,periodEnd),
      database.prepare("UPDATE businesses SET last_report_sent_at=?,report_email=COALESCE(report_email,?) WHERE id=?").bind(periodEnd,session.email,session.businessId)
    ]);
    return json({ok:true,message:"Weekly report sent."});
  }catch(error){
    console.error("manager_summary_failed",error);
    await database.prepare("INSERT INTO report_deliveries (id,business_id,recipient_email,status,period_start,period_end,error,snapshot,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),session.businessId,session.email,"failed",since,periodEnd,"Delivery failed",snapshot,periodEnd).run();
    return json({ok:false,message:"The report could not be sent."},503);
  }
}
