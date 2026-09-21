import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { emailOutcome } from "../../../../lib/operator";
import { adminAllowed, db, sameOrigin } from "../../_shared";

type FailedNotification={id:string;kind:string;customer_name:string|null;customer_email:string|null;message:string;business_name:string;business_id:string};

export async function POST(request:Request){
  const h=await headers();
  if(!adminAllowed(h)||!sameOrigin(request))return new Response("Forbidden",{status:403});
  const destination=(env.OWNER_EMAIL??"").trim();
  if(!env.RESEND_API_KEY||!destination)return Response.redirect(new URL("/admin?view=health&retry=unavailable",request.url),303);
  const database=db(),failed=await database.prepare(`SELECT n.id,n.kind,f.customer_name,f.customer_email,f.message,b.name business_name,b.id business_id FROM notifications n JOIN feedback f ON f.id=n.feedback_id JOIN businesses b ON b.id=f.business_id WHERE n.status='failed' ORDER BY n.created_at LIMIT 25`).all<FailedNotification>();
  let sent=0;
  for(const item of failed.results){
    const claim=await database.prepare("UPDATE notifications SET status='sending' WHERE id=? AND status='failed'").bind(item.id).run();if(!claim.meta.changes)continue;
    try{
      const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":`sv-alert-retry-${item.id}`},body:JSON.stringify({from:env.EMAIL_FROM??"StreetVouch <notifications@mail.streetvouch.com>",to:[destination],subject:item.kind==="serious_feedback"?"Important StreetVouch feedback":"Customer requested a reply",text:`${item.business_name} has private feedback requiring attention. Open the protected StreetVouch unified inbox to review it: https://app.streetvouch.com/`})});
      if(!response.ok){await database.prepare("UPDATE notifications SET status=?,last_error=? WHERE id=?").bind(emailOutcome(response.status),"Retry not confirmed; check the email provider.",item.id).run();continue;}
      await database.prepare("UPDATE notifications SET status='sent',sent_at=?,last_error=NULL WHERE id=?").bind(new Date().toISOString(),item.id).run();sent++;
      await database.prepare("INSERT INTO audit_events (id,business_id,actor_email,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),item.business_id,h.get("oai-authenticated-user-email"),"notification_retried","notification",item.id,"Provider accepted the retry",new Date().toISOString()).run();
    }catch(error){console.error("notification_retry_failed",error);await database.prepare("UPDATE notifications SET status='unknown',last_error=? WHERE id=?").bind("Retry failed",item.id).run();}
  }
  return Response.redirect(new URL(`/admin?view=health&retried=${sent}`,request.url),303);
}
