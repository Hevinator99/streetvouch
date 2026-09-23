import { getManagerSession } from "../../../manager-auth";
import { publishGoogleReply } from "../../../google";
import { db, json, sameOrigin } from "../../_shared";

export async function POST(request:Request){
  const session=await getManagerSession();if(!session||!sameOrigin(request))return json({ok:false},403);
  const body=await request.json() as {reviewId?:string;comment?:string};
  const comment=(body.comment??"").trim();if(!body.reviewId||comment.length<2||comment.length>4096)return json({ok:false,message:"Write a reply before publishing."},400);
  try{const outcome=await publishGoogleReply(session.businessId,body.reviewId,comment);try{await db().prepare("INSERT INTO audit_events (id,business_id,actor_email,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),session.businessId,session.email,"reply_published","google_review",body.reviewId,comment.slice(0,160),new Date().toISOString()).run();}catch(error){console.error("google_reply_audit_failed",error);}return json({ok:true,recorded:outcome.recorded,message:outcome.recorded?"Reply published on Google.":"Reply published on Google, but the dashboard could not update yet. Sync reviews before trying again."});}
  catch(error){console.error("google_reply_failed",error);return json({ok:false,message:"The reply could not be published. Check the Google connection and try again."},503);}
}
