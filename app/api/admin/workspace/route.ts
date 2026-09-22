import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { adminAllowed, db, json, sameOrigin, allow } from "../../_shared";
import { boundedPage, canReply, emailOutcome } from "../../../../lib/operator";
import { publishGoogleReply, syncGoogleReviews } from "../../../google";

type Row=Record<string,any>;
const unresolved="f.status NOT IN ('resolved','archived') AND (f.status IN ('new','attention','escalated') OR f.severity!='normal' OR f.due_at IS NOT NULL OR (f.contact_requested=1 AND f.contacted_at IS NULL))";
const checks=["business_details_complete","manager_account_active","google_connection_tested","customer_page_approved","nfc_tested","qr_tested","private_feedback_tested","notification_email_tested"];
export async function GET(request:Request){
  if(!adminAllowed(await headers()))return json({message:"Operator access required."},403);
  try{return await readWorkspace(request);}catch(error){console.error("operator_read_failed",error);return json({message:"The workspace could not load. Your records are safe; try again."},503);}
}
async function readWorkspace(request:Request){
  const d=db(),p=new URL(request.url).searchParams,view=p.get("view")??"overview",business=p.get("business")??"",page=boundedPage(p.get("page")),offset=(page-1)*40,q=p.get("q")??"",filter=p.get("filter")??"all";
  if(p.get("case")){
    const item=await d.prepare("SELECT f.*,b.name business_name,b.slug,b.contact_email FROM feedback f JOIN businesses b ON b.id=f.business_id WHERE f.id=?").bind(p.get("case")).first<Row>();if(!item)return json({message:"Message not found."},404);
    const [messages,audit,analysis]=await Promise.all([d.prepare("SELECT * FROM operator_messages WHERE feedback_id=? ORDER BY created_at").bind(item.id).all(),d.prepare("SELECT * FROM audit_events WHERE business_id=? AND entity_id=? ORDER BY created_at").bind(item.business_id,item.id).all(),d.prepare("SELECT * FROM ai_analyses WHERE business_id=? AND source_type='feedback' AND source_id=?").bind(item.business_id,item.id).first()]);return json({item,messages:messages.results,audit:audit.results,analysis});
  }
  if(view==="choices"){const rows=await d.prepare("SELECT id,name FROM businesses ORDER BY name COLLATE NOCASE LIMIT 2000").all();return json({rows:rows.results});}
  const directorySql=`SELECT b.id,b.slug,b.name,b.status,b.contact_email,b.owner_email,b.last_report_sent_at,b.created_at,b.page_approved,
    COALESCE(g.status,'not_connected') google_status,g.last_synced_at,g.last_error,
    (SELECT COUNT(*) FROM feedback f WHERE f.business_id=b.id AND ${unresolved}) work,
    (SELECT COUNT(*) FROM google_reviews r WHERE r.business_id=b.id AND r.reply_status!='published') unanswered,
    (SELECT COUNT(*) FROM notifications n JOIN feedback f ON f.id=n.feedback_id WHERE f.business_id=b.id AND n.status IN ('failed','unknown','sending')) failed_notifications,
    (SELECT COUNT(*) FROM operator_messages m WHERE m.business_id=b.id AND m.kind='reply' AND m.status IN ('failed','unknown','sending')) failed_messages,
    (SELECT COUNT(*) FROM report_deliveries rd WHERE rd.business_id=b.id AND rd.status IN ('failed','unknown')) failed_reports,
    CASE WHEN b.status='active' AND (b.last_report_sent_at IS NULL OR b.last_report_sent_at<datetime('now','-7 days')) THEN 1 ELSE 0 END report_due,
    (SELECT COUNT(*) FROM business_assets a WHERE a.business_id=b.id AND a.active=1) assets,
    (SELECT MAX(created_at) FROM events e WHERE e.business_id=b.id) last_activity,
    (SELECT COUNT(*) FROM events e WHERE e.business_id=b.id AND e.event_type='page_view' AND e.created_at>=datetime('now','-7 days')) visits,
    COALESCE((SELECT ${checks.join('+')} FROM onboarding_checks o WHERE o.business_id=b.id),0) setup_done
    FROM businesses b LEFT JOIN google_connections g ON g.business_id=b.id`;
  if(view==="businesses"||view==="health"||view==="overview"||view==="attention"){
    const conditions=["1=1"],args:unknown[]=[];
    if(q){conditions.push("(b.name LIKE ? OR b.contact_email LIKE ?)");args.push(`%${q}%`,`%${q}%`);}
    if(business){conditions.push("b.id=?");args.push(business);}
    if(["active","paused","completed","setup","awaiting_approval"].includes(filter)){conditions.push("b.status=?");args.push(filter);}
    const order=({name:"name COLLATE NOCASE",activity:"last_activity DESC",setup:"setup_done ASC",performance:"visits DESC",urgency:"(work+unanswered+failed_notifications+failed_messages+failed_reports+report_due) DESC"} as Row)[p.get("sort")??"urgency"]??"name COLLATE NOCASE";
    let outer="";if(filter==="attention")outer=" WHERE work+unanswered+failed_notifications+failed_messages+failed_reports+report_due>0 OR google_status IN ('sync_failed','reauthorisation_required','needs_attention')";
    if(filter==="due")outer=" WHERE status='active' AND (last_report_sent_at IS NULL OR last_report_sent_at<datetime('now','-7 days'))";
    const google=p.get("google");if(google){conditions.push(google==="connected"?"g.status='connected'":"COALESCE(g.status,'not_connected')!='connected'");}
    if(filter==="unhealthy")outer=" WHERE failed_notifications+failed_messages+failed_reports+report_due>0 OR google_status!='connected' OR last_synced_at IS NULL OR last_synced_at<datetime('now','-1 day') OR (status='active' AND assets=0)";
    const source=`SELECT * FROM (${directorySql} WHERE ${conditions.join(' AND ')})${outer}`;
    const [rows,count]=await Promise.all([d.prepare(`${source} ORDER BY ${order} LIMIT 40 OFFSET ?`).bind(...args,offset).all(),d.prepare(`SELECT COUNT(*) total FROM (${source})`).bind(...args).first()]);
    if(view==="businesses"||view==="health")return json({rows:rows.results,total:(count as Row)?.total,page,configured:{email:!!env.RESEND_API_KEY,google:!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET),ai:!!env.OPENAI_API_KEY,database:true}});
    const [summary,activity,queue]=await Promise.all([
      d.prepare(`SELECT (SELECT COUNT(*) FROM (${directorySql}) WHERE work+unanswered+failed_notifications+failed_messages+failed_reports+report_due>0 OR google_status IN ('sync_failed','reauthorisation_required','needs_attention')) attention,(SELECT COUNT(*) FROM businesses WHERE status='active') active,(SELECT COUNT(*) FROM businesses WHERE status IN ('setup','awaiting_approval')) setup,(SELECT COUNT(*) FROM feedback WHERE status='new') new_messages,(SELECT COUNT(*) FROM feedback WHERE status NOT IN ('resolved','archived') AND contact_requested=1 AND contacted_at IS NULL) waiting,(SELECT COUNT(*) FROM feedback WHERE status NOT IN ('resolved','archived') AND (severity='serious' OR status='escalated')) urgent,(SELECT COUNT(*) FROM google_reviews WHERE reply_status!='published') unanswered,(SELECT COUNT(*) FROM notifications WHERE status IN ('failed','unknown','sending')) failed_notifications,(SELECT COUNT(*) FROM report_deliveries WHERE status='failed') failed_reports,(SELECT COUNT(*) FROM report_deliveries WHERE status='sent' AND created_at>=datetime('now','-7 days')) sent_reports,(SELECT COUNT(*) FROM businesses WHERE status='active' AND (last_report_sent_at IS NULL OR last_report_sent_at<datetime('now','-7 days'))) due_reports,(SELECT COUNT(*) FROM google_connections WHERE status IN ('sync_failed','needs_attention','reauthorisation_required')) failed_google,(SELECT COUNT(*) FROM operator_messages WHERE kind='reply' AND status IN ('failed','unknown','sending')) failed_messages`).first(),
      d.prepare("SELECT a.*,b.name business_name FROM audit_events a JOIN businesses b ON b.id=a.business_id ORDER BY a.created_at DESC LIMIT 12").all(),
      d.prepare(`SELECT f.id,f.business_id,b.name business_name,f.severity,f.status,f.created_at,f.contact_requested,f.contacted_at,f.assignee,f.due_at FROM feedback f JOIN businesses b ON b.id=f.business_id WHERE ${unresolved} ORDER BY CASE WHEN f.severity='serious' OR f.status='escalated' THEN 0 WHEN f.due_at<datetime('now') THEN 1 ELSE 2 END,f.created_at LIMIT 30`).all()
    ]);return json({rows:rows.results,summary,activity:activity.results,queue:queue.results,total:(count as Row)?.total,page});
  }
  if(view==="profile"){
    const b=await d.prepare(`SELECT b.*,COALESCE(g.status,'not_connected') google_status,g.last_synced_at,g.last_error,g.google_location_title,(SELECT COUNT(*) FROM feedback WHERE business_id=b.id AND status NOT IN ('resolved','archived')) open_cases,(SELECT COUNT(*) FROM feedback WHERE business_id=b.id AND contact_requested=1 AND contacted_at IS NULL AND status NOT IN ('resolved','archived')) waiting,(SELECT COUNT(*) FROM google_reviews WHERE business_id=b.id AND reply_status!='published') unanswered,(SELECT COUNT(*) FROM notifications n JOIN feedback f ON f.id=n.feedback_id WHERE f.business_id=b.id AND n.status IN ('failed','unknown','sending')) failed_alerts,(SELECT COUNT(*) FROM report_deliveries WHERE business_id=b.id AND status='failed') failed_reports FROM businesses b LEFT JOIN google_connections g ON g.business_id=b.id WHERE b.id=?`).bind(business).first();if(!b)return json({message:"Business not found."},404);
    const [setup,assets,owners,activity,analysis,performance]=await Promise.all([d.prepare("SELECT * FROM onboarding_checks WHERE business_id=?").bind(business).first(),d.prepare("SELECT a.*,(SELECT COUNT(*) FROM events e WHERE e.asset_id=a.id AND e.created_at>=datetime('now','-30 days')) interactions FROM business_assets a WHERE a.business_id=? ORDER BY a.created_at DESC").bind(business).all(),d.prepare("SELECT id,email,display_name,role,active,invited_at,invitation_accepted_at,last_login_at FROM manager_users WHERE business_id=?").bind(business).all(),d.prepare("SELECT * FROM audit_events WHERE business_id=? ORDER BY created_at DESC LIMIT 100").bind(business).all(),d.prepare("SELECT source_type,source_id,urgency,sentiment,themes,recommended_action,rationale,model,created_at FROM ai_analyses WHERE business_id=? ORDER BY created_at DESC LIMIT 50").bind(business).all(),d.prepare("SELECT event_type,CASE WHEN created_at>=datetime('now','-7 days') THEN 'current' ELSE 'previous' END period,COUNT(*) count FROM events WHERE business_id=? AND created_at>=datetime('now','-14 days') GROUP BY event_type,period").bind(business).all()]);return json({business:b,setup,assets:assets.results,owners:owners.results,activity:activity.results,analysis:analysis.results,performance:performance.results});
  }
  const where=["1=1"],args:unknown[]=[];if(business){where.push("x.business_id=?");args.push(business);}if(p.get("from")){where.push(`${view==='reviews'?'x.google_created_at':'x.created_at'}>=?`);args.push(p.get("from"));}if(p.get("to")){where.push(`${view==='reviews'?'x.google_created_at':'x.created_at'}<?`);args.push(`${p.get('to')}T23:59:59.999Z`);}
  let source="";
  if(view==="inbox"){
    const filters:Row={new:"x.status='new'",awaiting:"x.contact_requested=1 AND x.contacted_at IS NULL AND x.status NOT IN ('resolved','archived')",attention:"x.status NOT IN ('resolved','archived') AND (x.severity!='normal' OR x.status IN ('attention','escalated'))",urgent:"x.status NOT IN ('resolved','archived') AND (x.severity='serious' OR x.status='escalated')",resolved:"x.status='resolved'",failed:"EXISTS(SELECT 1 FROM operator_messages m WHERE m.feedback_id=x.id AND m.status IN ('failed','unknown','sending'))"};if(filters[filter])where.push(filters[filter]);if(q){where.push("(x.message LIKE ? OR x.customer_name LIKE ? OR b.name LIKE ?)");args.push(...Array(3).fill(`%${q}%`));}source=`SELECT x.*,b.name business_name,b.slug FROM feedback x JOIN businesses b ON b.id=x.business_id WHERE ${where.join(' AND ')} ORDER BY x.created_at DESC`;
  }else if(view==="reviews"){
    const filters:Row={unanswered:"x.reply_status!='published'",negative:"x.rating<=3",replied:"x.reply_status='published'",recent:"x.google_created_at>=datetime('now','-7 days')"};if(filters[filter])where.push(filters[filter]);if(q){where.push("(x.comment LIKE ? OR x.reviewer_name LIKE ? OR b.name LIKE ?)");args.push(...Array(3).fill(`%${q}%`));}source=`SELECT x.*,b.name business_name,COALESCE(g.status,'not_connected') google_status FROM google_reviews x JOIN businesses b ON b.id=x.business_id LEFT JOIN google_connections g ON g.business_id=x.business_id WHERE ${where.join(' AND ')} ORDER BY x.google_created_at DESC`;
  }else if(view==="reports"){if(q){where.push("(b.name LIKE ? OR x.recipient_email LIKE ?)");args.push(`%${q}%`,`%${q}%`);}if(["sent","failed"].includes(filter)){where.push("x.status=?");args.push(filter);}source=`SELECT x.*,b.name business_name FROM report_deliveries x JOIN businesses b ON b.id=x.business_id WHERE ${where.join(' AND ')} ORDER BY x.created_at DESC`;
  }else return json({message:"Unknown view"},400);
  const [rows,count]=await Promise.all([d.prepare(`${source} LIMIT 40 OFFSET ?`).bind(...args,offset).all(),d.prepare(`SELECT COUNT(*) total FROM (${source})`).bind(...args).first<Row>()]);return json({rows:rows.results,total:count?.total??0,page});
}

export async function POST(request:Request){
  const h=await headers();if(!adminAllowed(h)||!sameOrigin(request))return json({message:"Operator access required."},403);
  try{
    const body=await request.json() as Row,d=db(),actor=h.get("oai-authenticated-user-email")!,now=new Date().toISOString();
    if(!await allow(d,`operator:${actor}`,120,60))return json({message:"Please wait a moment before trying again."},429);
    const audit=(businessId:string,action:string,id:string,detail:string)=>d.prepare("INSERT INTO audit_events (id,business_id,actor_email,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),businessId,actor,action,"operator",id,detail,now);
    if(body.action==="sync"){
      const g=await d.prepare("SELECT status FROM google_connections WHERE business_id=?").bind(body.businessId).first<Row>();if(!["connected","sync_failed"].includes(g?.status))return json({message:"The owner must connect Google from their portal first."},409);
      try{const count=await syncGoogleReviews(body.businessId);await d.prepare("UPDATE onboarding_checks SET google_connection_tested=1,updated_at=? WHERE business_id=?").bind(now,body.businessId).run();await audit(body.businessId,"google_synced",body.businessId,`${count} reviews checked`).run();return json({message:"Google reviews refreshed."});}catch{await d.prepare("UPDATE google_connections SET last_error=? WHERE business_id=?").bind("Review sync failed. Retry or ask the owner to reconnect Google.",body.businessId).run();return json({message:"Google could not be reached. Ask the owner to check access, then retry."},502);}
    }
    if(body.action==="review_draft"||body.action==="review_publish"){
      const r=await d.prepare("SELECT r.*,g.status google_status FROM google_reviews r LEFT JOIN google_connections g ON g.business_id=r.business_id WHERE r.id=? AND r.business_id=?").bind(body.id,body.businessId).first<Row>();if(!r)return json({message:"Review not found."},404);const text=String(body.text??"").trim();if(!text||text.length>4096)return json({message:"Write a reply of up to 4,096 characters."},400);
      if(body.action==="review_publish"){if(!body.confirmed)return json({message:"Confirm publication first."},400);if(r.google_status!=="connected")return json({message:"Google is disconnected. The owner needs to reconnect it."},409);try{await publishGoogleReply(r.business_id,r.id,text);}catch{return json({message:"Google did not confirm publication. Sync reviews to check before trying again."},502);}}
      else await d.prepare("UPDATE google_reviews SET suggested_reply=? WHERE id=? AND business_id=?").bind(text,r.id,r.business_id).run();await audit(r.business_id,body.action,r.id,body.action==="review_publish"?"Approved public reply published":"Public reply draft saved").run();return json({message:body.action==="review_publish"?"Reply published to Google.":"Draft saved."});
    }
    if(body.action==="asset"){
      const a=await d.prepare("SELECT * FROM business_assets WHERE id=? AND business_id=?").bind(body.id,body.businessId).first<Row>();if(!a)return json({message:"Asset not found."},404);if(!body.confirmed)return json({message:"Confirm the asset change."},400);
      await d.batch([d.prepare("UPDATE business_assets SET active=?,updated_at=? WHERE id=?").bind(body.active?1:0,now,a.id),audit(a.business_id,"asset_status",a.id,body.active?"Asset enabled":"Asset disabled")]);return json({message:"Asset updated."});
    }
    const f=await d.prepare("SELECT f.*,b.name business_name,b.contact_email FROM feedback f JOIN businesses b ON b.id=f.business_id WHERE f.id=? AND f.business_id=?").bind(body.id??"",body.businessId??"").first<Row>();if(!f)return json({message:"Feedback not found for this business."},404);
    if(body.action==="case"){
      const status=String(body.status??f.status);if(!["new","reviewed","attention","escalated","resolved"].includes(status))return json({message:"Invalid status."},400);
      if(body.dueAt&&Number.isNaN(Date.parse(body.dueAt)))return json({message:"Choose a valid due date."},400);
      const assignee=String(body.assignee??f.assignee??"").slice(0,160),due=body.dueAt?new Date(body.dueAt).toISOString():null;
      await d.batch([d.prepare("UPDATE feedback SET status=?,assignee=?,due_at=?,contacted_at=CASE WHEN ?=1 THEN ? ELSE contacted_at END,resolved_at=? WHERE id=? AND business_id=?").bind(status,assignee||null,due,body.contacted?1:0,now,status==="resolved"?now:null,f.id,f.business_id),audit(f.business_id,"case_updated",f.id,JSON.stringify({from:f.status,to:status,assignee,due,contacted:!!body.contacted}))]);return json({message:"Case updated."});
    }
    if(body.action==="note"){
      const text=String(body.text??"").trim().slice(0,5000);if(!text)return json({message:"Write a note first."},400);await d.batch([d.prepare("INSERT INTO operator_messages (id,business_id,feedback_id,kind,body,status,actor,created_at,updated_at) VALUES (?,?,?,'note',?,'internal',?,?,?)").bind(crypto.randomUUID(),f.business_id,f.id,text,actor,now,now),audit(f.business_id,"internal_note_added",f.id,"Private operator note added")]);return json({message:"Internal note saved. Nothing was emailed."});
    }
    if(body.action==="draft"){
      const text=String(body.text??"").trim();if(!text||text.length>10000)return json({message:"Write a reply of up to 10,000 characters."},400);
      const id=String(body.messageId??crypto.randomUUID());const previous=await d.prepare("SELECT * FROM operator_messages WHERE id=?").bind(id).first<Row>();if(previous&&(previous.feedback_id!==f.id||previous.status!=="draft"))return json({message:"This message is locked. Start a new draft."},409);
      await d.batch([d.prepare("INSERT INTO operator_messages (id,business_id,feedback_id,kind,recipient,body,status,actor,created_at,updated_at) VALUES (?,?,?,'reply',?,?,'draft',?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at WHERE operator_messages.status='draft'").bind(id,f.business_id,f.id,f.customer_email,text,actor,now,now),audit(f.business_id,"reply_draft_saved",f.id,"Private reply draft saved")]);return json({message:"Draft saved.",messageId:id});
    }
    if(body.action==="send"){
      if(!body.confirmed||!canReply(f))return json({message:"A valid customer email and an explicit contact request are required."},400);if(!env.RESEND_API_KEY)return json({message:"Email delivery is not configured. Your draft is saved."},503);
      const m=await d.prepare("SELECT * FROM operator_messages WHERE id=? AND feedback_id=? AND business_id=? AND kind='reply'").bind(body.messageId,f.id,f.business_id).first<Row>();if(!m)return json({message:"Save a draft first."},400);
      const claim=await d.prepare("UPDATE operator_messages SET status='sending',updated_at=? WHERE id=? AND status='draft'").bind(now,m.id).run();if(!claim.meta.changes)return json({message:"This message was already submitted. Check its status before creating another."},409);
      let state="unknown",providerId:null|string=null,error:null|string="Delivery result is uncertain. Check the email provider before sending another reply.";
      try{const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":`sv-reply-${m.id}`},body:JSON.stringify({from:env.EMAIL_FROM??"StreetVouch <notifications@mail.streetvouch.com>",to:[f.customer_email],...(f.contact_email?{reply_to:f.contact_email}:{}),subject:`Regarding your feedback to ${f.business_name}`,text:m.body})});state=emailOutcome(response.status);if(state==="sent"){const result=await response.json() as Row;providerId=result.id??null;error=null;}else if(state==="failed")error="The email service rejected this message. Check the recipient and sender configuration.";}catch{}
      await d.batch([d.prepare("UPDATE operator_messages SET status=?,provider_id=?,error=?,updated_at=? WHERE id=?").bind(state,providerId,error,new Date().toISOString(),m.id),audit(f.business_id,`private_reply_${state}`,f.id,state==="sent"?"Email accepted by provider; inbox delivery not confirmed":error!),...(state==="sent"?[d.prepare("UPDATE feedback SET contacted_at=? WHERE id=?").bind(now,f.id)]:[])]);
      return json({message:state==="sent"?"Reply accepted by the email service. Delivery to the inbox is not yet confirmed.":error},state==="sent"?200:502);
    }
    return json({message:"Unknown action."},400);
  }catch(error){console.error("operator_action_failed",error);return json({message:"The action could not be completed. Check the record before retrying."},500);}
}
