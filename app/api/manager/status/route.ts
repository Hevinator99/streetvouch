import { getManagerSession } from "../../../manager-auth";
import { db, json, sameOrigin } from "../../_shared";
export async function POST(request:Request){
  const session=await getManagerSession();if(!session||!sameOrigin(request))return json({ok:false},403);
  const body=await request.json() as {id?:string;status?:string;action?:string;note?:string};if(!body.id)return json({ok:false},400);
  const database=db(),now=new Date().toISOString();
  if(body.action==="delete"){
    const owned=await database.prepare("SELECT id FROM feedback WHERE id=? AND business_id=?").bind(body.id,session.businessId).first();if(!owned)return json({ok:false,message:"Feedback not found."},404);
    await database.batch([database.prepare("DELETE FROM notifications WHERE feedback_id=?").bind(body.id),database.prepare("DELETE FROM feedback WHERE id=? AND business_id=?").bind(body.id,session.businessId),database.prepare("INSERT INTO audit_events (id,business_id,actor_email,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),session.businessId,session.email,"deleted","feedback",body.id,now)]);
    return json({ok:true});
  }
  if(body.action==="contacted"){
    await database.batch([database.prepare("UPDATE feedback SET contacted_at=?,status='resolved',resolved_at=? WHERE id=? AND business_id=?").bind(now,now,body.id,session.businessId),database.prepare("INSERT INTO audit_events (id,business_id,actor_email,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),session.businessId,session.email,"customer_contacted","feedback",body.id,now)]);
    return json({ok:true});
  }
  if(body.action==="note"){
    const note=(body.note??"").trim().slice(0,1000);await database.batch([database.prepare("UPDATE feedback SET internal_note=? WHERE id=? AND business_id=?").bind(note||null,body.id,session.businessId),database.prepare("INSERT INTO audit_events (id,business_id,actor_email,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),session.businessId,session.email,"note_updated","feedback",body.id,note?"Note saved":"Note cleared",now)]);return json({ok:true});
  }
  if(!new Set(["new","reviewed","resolved","archived"]).has(body.status??""))return json({ok:false},400);
  const reviewed=body.status==="new"?null:now,resolved=body.status==="resolved"?now:null;
  await database.batch([database.prepare("UPDATE feedback SET status=?,reviewed_at=?,resolved_at=? WHERE id=? AND business_id=?").bind(body.status,reviewed,resolved,body.id,session.businessId),database.prepare("INSERT INTO audit_events (id,business_id,actor_email,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),session.businessId,session.email,"status_changed","feedback",body.id,body.status??"",now)]);
  return json({ok:true});
}
