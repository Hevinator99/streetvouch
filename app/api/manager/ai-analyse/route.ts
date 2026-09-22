import { analyseCustomerText } from "../../../ai-engine";
import { getManagerSession } from "../../../manager-auth";
import { db, json, sameOrigin } from "../../_shared";

export async function POST(request:Request){
  const session=await getManagerSession();if(!session||!sameOrigin(request))return json({ok:false,message:"Access denied."},403);
  const body=await request.json() as {sourceType?:string;sourceId?:string};if(!new Set(["feedback","google_review"]).has(body.sourceType??"")||!body.sourceId)return json({ok:false,message:"Invalid item."},400);
  const database=db();let text="",rating:number|undefined;
  if(body.sourceType==="feedback"){const row=await database.prepare("SELECT message FROM feedback WHERE id=? AND business_id=?").bind(body.sourceId,session.businessId).first<{message:string}>();if(!row)return json({ok:false,message:"Feedback not found."},404);text=row.message;}
  else{const row=await database.prepare("SELECT comment,rating FROM google_reviews WHERE id=? AND business_id=?").bind(body.sourceId,session.businessId).first<{comment:string|null;rating:number}>();if(!row)return json({ok:false,message:"Review not found."},404);text=row.comment??`Customer left a ${row.rating}-star rating without written feedback.`;rating=row.rating;}
  try{
    const analysis=await analyseCustomerText(text,body.sourceType as "feedback"|"google_review",rating),now=new Date().toISOString();
    await database.batch([
      database.prepare(`INSERT INTO ai_analyses (id,business_id,source_type,source_id,urgency,confidence,sentiment,themes,recommended_action,draft_reply,rationale,model,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'suggested',?,?) ON CONFLICT(business_id,source_type,source_id) DO UPDATE SET urgency=excluded.urgency,confidence=excluded.confidence,sentiment=excluded.sentiment,themes=excluded.themes,recommended_action=excluded.recommended_action,draft_reply=excluded.draft_reply,rationale=excluded.rationale,model=excluded.model,status='suggested',updated_at=excluded.updated_at`).bind(crypto.randomUUID(),session.businessId,body.sourceType,body.sourceId,analysis.urgency,analysis.confidence,analysis.sentiment,JSON.stringify(analysis.themes),analysis.recommended_action,analysis.draft_reply,analysis.rationale,analysis.model,now,now),
      database.prepare("INSERT INTO audit_events (id,business_id,actor_email,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),session.businessId,session.email,"ai_analysis_created",body.sourceType,body.sourceId,`${analysis.urgency} · ${analysis.model}`,now)
    ]);
    return json({ok:true,draft:analysis.draft_reply,automated:analysis.model!=="streetvouch-rules-v1",message:analysis.model==="streetvouch-rules-v1"?"Suggested starting point ready. Review and personalise before publishing.":"AI draft ready. Review and edit before publishing."});
  }catch(error){console.error("ai_analysis_failed",error);return json({ok:false,message:"Analysis could not be completed. Please try again."},503);}
}
