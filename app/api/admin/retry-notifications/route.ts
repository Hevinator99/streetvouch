import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { adminAllowed, db, sameOrigin } from "../../_shared";

type FailedNotification={id:string;kind:string;customer_name:string|null;customer_email:string|null;message:string;business_name:string};

export async function POST(request:Request){
  const h=await headers();
  if(!adminAllowed(h)||!sameOrigin(request))return new Response("Forbidden",{status:403});
  const destination=(env.OWNER_EMAIL??"").trim();
  if(!env.RESEND_API_KEY||!destination)return Response.redirect(new URL("/admin/health?retry=unavailable",request.url),303);
  const database=db(),failed=await database.prepare(`SELECT n.id,n.kind,f.customer_name,f.customer_email,f.message,b.name business_name FROM notifications n JOIN feedback f ON f.id=n.feedback_id JOIN businesses b ON b.id=f.business_id WHERE n.status='failed' ORDER BY n.created_at LIMIT 25`).all<FailedNotification>();
  let sent=0;
  for(const item of failed.results){
    try{
      const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:env.EMAIL_FROM??"StreetVouch <notifications@mail.streetvouch.com>",to:[destination],subject:item.kind==="serious_feedback"?"Important StreetVouch feedback":"Customer requested a reply",text:`${item.business_name} received private feedback.\n\nFrom: ${item.customer_name??"Not provided"}\nReply email: ${item.customer_email??"Not provided"}\n\n${item.message}\n\nOpen the protected StreetVouch management page to review it.`})});
      if(!response.ok)throw new Error(`Email service returned ${response.status}`);
      await database.prepare("UPDATE notifications SET status='sent',sent_at=?,last_error=NULL WHERE id=?").bind(new Date().toISOString(),item.id).run();sent++;
    }catch(error){console.error("notification_retry_failed",error);await database.prepare("UPDATE notifications SET last_error=? WHERE id=?").bind("Retry failed",item.id).run();}
  }
  return Response.redirect(new URL(`/admin/health?retried=${sent}`,request.url),303);
}
