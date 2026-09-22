import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { adminAllowed,db,json,sameOrigin } from "../../_shared";
import { emailOutcome } from "../../../../lib/operator";
import { buildWeeklyReport, type WeeklyMetricSet, type WeeklyReportInput } from "../../../../lib/weekly-report";

type Row=Record<string,any>;

function eventCounts(rows:Row[]){return Object.fromEntries(rows.map(row=>[row.event_type,Number(row.count)]));}
function metrics(counts:Record<string,number>,feedbackCount:number,review:Row|null):WeeklyMetricSet{return{
  visits:counts.page_view??0,nfcTaps:counts.nfc_tap??0,qrScans:counts.qr_scan??0,googleClicks:counts.google_click??0,
  privateMessages:feedbackCount,newGoogleReviews:Number(review?.count??0),averageRating:review?.average==null?null:Number(review.average),
};}
function analysisSummary(rows:Row[]){
  const themes=new Map<string,number>(),sentiment={positive:0,mixed:0,negative:0,neutral:0};
  for(const row of rows){
    if(row.sentiment in sentiment)sentiment[row.sentiment as keyof typeof sentiment]++;
    try{for(const theme of JSON.parse(row.themes) as string[])themes.set(theme,(themes.get(theme)??0)+1);}catch{}
  }
  return{sentiment,themes:[...themes.entries()].sort((a,b)=>b[1]-a[1]).map(([theme])=>theme)};
}

async function reportInput(database:ReturnType<typeof db>,business:Row,periodStart:string,periodEnd:string):Promise<WeeklyReportInput>{
  const previousStart=new Date(new Date(periodStart).getTime()-(new Date(periodEnd).getTime()-new Date(periodStart).getTime())).toISOString();
  const [currentEvents,previousEvents,currentFeedback,previousFeedback,currentReviews,previousReviews,outstanding,analysisRows]=await Promise.all([
    database.prepare("SELECT event_type,COUNT(*) count FROM events WHERE business_id=? AND created_at>=? AND created_at<? GROUP BY event_type").bind(business.id,periodStart,periodEnd).all<Row>(),
    database.prepare("SELECT event_type,COUNT(*) count FROM events WHERE business_id=? AND created_at>=? AND created_at<? GROUP BY event_type").bind(business.id,previousStart,periodStart).all<Row>(),
    database.prepare("SELECT message,severity,contact_requested FROM feedback WHERE business_id=? AND created_at>=? AND created_at<? ORDER BY created_at DESC LIMIT 20").bind(business.id,periodStart,periodEnd).all<Row>(),
    database.prepare("SELECT COUNT(*) count FROM feedback WHERE business_id=? AND created_at>=? AND created_at<?").bind(business.id,previousStart,periodStart).first<Row>(),
    database.prepare("SELECT reviewer_name,rating,comment FROM google_reviews WHERE business_id=? AND google_created_at>=? AND google_created_at<? ORDER BY google_created_at DESC LIMIT 20").bind(business.id,periodStart,periodEnd).all<Row>(),
    database.prepare("SELECT COUNT(*) count,AVG(rating) average FROM google_reviews WHERE business_id=? AND google_created_at>=? AND google_created_at<?").bind(business.id,previousStart,periodStart).first<Row>(),
    database.prepare("SELECT SUM(CASE WHEN contact_requested=1 AND contacted_at IS NULL AND status!='resolved' THEN 1 ELSE 0 END) waiting,SUM(CASE WHEN severity!='normal' AND status!='resolved' THEN 1 ELSE 0 END) flagged,(SELECT COUNT(*) FROM google_reviews WHERE business_id=? AND reply_status!='published') review_replies FROM feedback WHERE business_id=?").bind(business.id,business.id).first<Row>(),
    database.prepare("SELECT sentiment,themes FROM ai_analyses WHERE business_id=? AND created_at>=? AND created_at<? ORDER BY created_at DESC LIMIT 100").bind(business.id,periodStart,periodEnd).all<Row>(),
  ]);
  const currentReviewSummary={count:currentReviews.results.length,average:currentReviews.results.length?currentReviews.results.reduce((sum,row)=>sum+Number(row.rating),0)/currentReviews.results.length:null};
  const current=metrics(eventCounts(currentEvents.results),currentFeedback.results.length,currentReviewSummary),previous=metrics(eventCounts(previousEvents.results),Number(previousFeedback?.count??0),previousReviews),analysis=analysisSummary(analysisRows.results);
  return{businessName:String(business.name),businessSlug:String(business.slug),periodStart,periodEnd,current,previous,awaitingContact:Number(outstanding?.waiting??0),flagged:Number(outstanding?.flagged??0),reviewsAwaitingReply:Number(outstanding?.review_replies??0),feedback:currentFeedback.results.map(row=>({message:String(row.message),severity:String(row.severity),contactRequested:Boolean(row.contact_requested)})),reviews:currentReviews.results.map(row=>({comment:row.comment?String(row.comment):null,rating:Number(row.rating),reviewerName:row.reviewer_name?String(row.reviewer_name):null})),themes:analysis.themes,sentiment:analysis.sentiment};
}

export async function POST(request:Request){
  const h=await headers();if(!adminAllowed(h)||!sameOrigin(request))return json({message:"Operator access required."},403);
  const database=db(),body=await request.json() as Row,business=await database.prepare("SELECT id,name,slug,report_email,contact_email,owner_email FROM businesses WHERE id=?").bind(body.businessId??"").first<Row>();
  if(!business)return json({message:"Business not found."},404);
  if(!env.RESEND_API_KEY)return json({message:"Email delivery is not configured."},503);
  const now=new Date().toISOString(),actor=h.get("oai-authenticated-user-email")!;
  let delivery:Row|null=null;
  if(body.reportId){delivery=await database.prepare("SELECT * FROM report_deliveries WHERE id=? AND business_id=? AND status='failed'").bind(body.reportId,business.id).first<Row>();if(!delivery)return json({message:"Only a failed report for this business can be retried."},409);}
  const recipient=delivery?.recipient_email??business.report_email??business.contact_email??business.owner_email;
  if(!recipient||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))return json({message:"Add a valid report recipient to the business details."},400);
  const periodStart=delivery?.period_start??new Date(Date.now()-7*86400000).toISOString(),periodEnd=delivery?.period_end??now;
  const input=await reportInput(database,business,periodStart,periodEnd),report=buildWeeklyReport(input);
  const snapshot=JSON.stringify({...input.current,awaitingContact:input.awaitingContact,flagged:input.flagged,reviewsAwaitingReply:input.reviewsAwaitingReply,sentiment:input.sentiment,themes:input.themes});
  const id=delivery?.id??`weekly-${business.id}-${crypto.randomUUID()}`;
  await database.prepare("INSERT OR IGNORE INTO operator_messages (id,business_id,kind,recipient,body,status,actor,created_at,updated_at) VALUES (?,?,'report',?,?,'draft',?,?,?)").bind(id,business.id,recipient,report.html,actor,now,now).run();
  const claim=await database.prepare("UPDATE operator_messages SET status='sending',body=?,updated_at=? WHERE id=? AND status IN ('draft','failed')").bind(report.html,now,id).run();
  if(!claim.meta.changes)return json({message:"This delivery is already being processed. Refresh the report list before trying again."},409);
  let state="unknown",error:string|null="The email result is uncertain. Check the provider before retrying.",provider:string|null=null;
  try{
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":`sv-report-${id}`},body:JSON.stringify({from:env.EMAIL_FROM??"StreetVouch <notifications@mail.streetvouch.com>",to:[recipient],subject:report.subject,html:report.html,text:report.text})});
    state=emailOutcome(response.status);if(state==="sent"){provider=((await response.json()) as Row).id;error=null;}else if(state==="failed")error="The email provider rejected this summary. Check the recipient and sender configuration.";
  }catch{}
  await database.batch([
    database.prepare("UPDATE operator_messages SET status=?,error=?,provider_id=?,updated_at=? WHERE id=?").bind(state,error,provider,new Date().toISOString(),id),
    database.prepare("INSERT INTO report_deliveries (id,business_id,recipient_email,status,period_start,period_end,error,snapshot,created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,error=excluded.error,snapshot=excluded.snapshot").bind(id,business.id,recipient,state,periodStart,periodEnd,error,snapshot,now),
    database.prepare("INSERT INTO audit_events (id,business_id,actor_email,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),business.id,actor,`report_${state}`,"report",id,`Weekly summary to ${recipient}`,now),
    ...(state==="sent"?[database.prepare("UPDATE businesses SET last_report_sent_at=?,report_email=COALESCE(report_email,?) WHERE id=?").bind(now,recipient,business.id)]:[]),
  ]);
  return json({message:state==="sent"?"Weekly summary accepted by the email provider.":error},state==="sent"?200:502);
}
