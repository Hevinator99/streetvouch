import { env } from "cloudflare:workers";
import { allow, anonymousKey, BUSINESS, db, enforceRetention, ensureBusiness, json, sameOrigin } from "../_shared";
import { classifyFeedbackSeverity } from "../../../lib/security";
async function sendAlert(feedbackId:string,message:string,name:string|null,email:string|null,kind:string){
  const database=db(), notificationId=crypto.randomUUID(), createdAt=new Date().toISOString();
  await database.prepare("INSERT INTO notifications (id, feedback_id, kind, status, created_at) VALUES (?, ?, ?, 'queued', ?)").bind(notificationId,feedbackId,kind,createdAt).run();
  if(!env.RESEND_API_KEY||!env.OWNER_EMAIL)return;
  try{const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:env.EMAIL_FROM??"StreetVouch <alerts@streetvouch.com>",to:[env.OWNER_EMAIL],subject:kind==="serious_feedback"?"Important StreetVouch feedback":"Customer requested a reply",text:`Village Barbers Cobham received private feedback.\n\nFrom: ${name??"Not provided"}\nReply email: ${email??"Not provided"}\n\n${message}\n\nOpen the protected StreetVouch management page to review it.`})});if(!response.ok)throw new Error(`Email service returned ${response.status}`);await database.prepare("UPDATE notifications SET status='sent', sent_at=? WHERE id=?").bind(new Date().toISOString(),notificationId).run();}
  catch(error){console.error("notification_failed",error);await database.prepare("UPDATE notifications SET status='failed', last_error=? WHERE id=?").bind("Delivery failed",notificationId).run();}
}
export async function POST(request:Request){
  try{
    if(!sameOrigin(request))return json({ok:false,message:"Please refresh the page and try again."},403);if(!(request.headers.get("content-type")??"").includes("application/json"))return json({ok:false,message:"Invalid request."},415);
    const body=await request.json() as Record<string,unknown>;if(body.website)return json({ok:true,message:"Thank you. Your feedback has been received."});
    const message=typeof body.message==="string"?body.message.trim():"",name=typeof body.name==="string"&&body.name.trim()?body.name.trim().slice(0,100):null,contactRequested=body.contactRequested===true,email=typeof body.email==="string"&&body.email.trim()?body.email.trim().toLowerCase().slice(0,254):null;
    if(body.business!==BUSINESS.slug||message.length<3||message.length>2000)return json({ok:false,message:"Please enter between 3 and 2,000 characters."},400);if(name&&/[<>]/.test(name))return json({ok:false,message:"Please check the name entered."},400);if(contactRequested&&(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return json({ok:false,message:"Enter a valid email so the team can reply."},400);
    const database=db();await ensureBusiness(database);await enforceRetention(database);if(!await allow(database,`feedback:${await anonymousKey(request,"feedback")}`,5,3600))return json({ok:false,message:"Too many submissions from this device. Please try again later."},429);
    const severity=classifyFeedbackSeverity(message),id=crypto.randomUUID(),now=new Date().toISOString(),session=typeof body.session==="string"?body.session.slice(0,80):null;
    await database.batch([database.prepare("INSERT INTO feedback (id,business_id,customer_name,customer_email,message,contact_requested,severity,status,created_at) VALUES (?,?,?,?,?,?,?,'new',?)").bind(id,BUSINESS.id,name,contactRequested?email:null,message,contactRequested?1:0,severity,now),database.prepare("INSERT INTO events (id,business_id,event_type,session_id,created_at) VALUES (?,?,'private_submission',?,?)").bind(crypto.randomUUID(),BUSINESS.id,session,now),...(contactRequested?[database.prepare("INSERT INTO events (id,business_id,event_type,session_id,created_at) VALUES (?,?,'contact_request',?,?)").bind(crypto.randomUUID(),BUSINESS.id,session,now)]:[])]);
    if(severity==="serious"||contactRequested)await sendAlert(id,message,name,email,severity==="serious"?"serious_feedback":"contact_requested");return json({ok:true,message:"Thank you. Your feedback has been sent securely to the team."});
  }catch(error){console.error("feedback_submission_failed",error);return json({ok:false,message:"We couldn’t send your feedback just now. Your message is still here—please try again."},503);}
}
