import { env } from "cloudflare:workers";
import { getManagerSession } from "../../../manager-auth";
import { buildWeeklyReport, feedbackNeedsAttention, type AttentionFeedback, type WeeklyMetricSet } from "../../../../lib/weekly-report";
import { db, json, sameOrigin } from "../../_shared";
import { fallbackAnalysis } from "../../../ai-engine";

type Row=Record<string,any>;

function eventCounts(rows:Row[]){return Object.fromEntries(rows.map(row=>[row.event_type,Number(row.count)]));}
function metrics(counts:Record<string,number>,feedbackCount:number,review:Row|null):WeeklyMetricSet{return{
  visits:counts.page_view??0,nfcTaps:counts.nfc_tap??0,qrScans:counts.qr_scan??0,googleClicks:counts.google_click??0,
  privateMessages:feedbackCount,newGoogleReviews:Number(review?.count??0),averageRating:review?.average==null?null:Number(review.average),
};}
function analysisSummary(rows:Row[],feedback:Row[],reviews:Row[]){const tally=new Map<string,number>(),sentiment={positive:0,mixed:0,negative:0,neutral:0},saved=new Map(rows.map(row=>[`${row.source_type}:${row.source_id}`,row])),items=[...feedback.map(row=>({key:`feedback:${row.id}`,text:String(row.message),rating:undefined})),...reviews.filter(row=>row.comment).map(row=>({key:`google_review:${row.id}`,text:String(row.comment),rating:Number(row.rating)}))];for(const item of items){const row=saved.get(item.key),fallback=row?null:fallbackAnalysis(item.text,item.rating),tone=String(row?.sentiment??fallback?.sentiment??"neutral");if(tone in sentiment)sentiment[tone as keyof typeof sentiment]++;let itemThemes:string[]=[];try{itemThemes=JSON.parse(row?.themes??"[]");}catch{}for(const theme of itemThemes.length?itemThemes:(fallback?.themes??[]))tally.set(theme,(tally.get(theme)??0)+1);}return{themes:[...tally.entries()].sort((a,b)=>b[1]-a[1]).map(([theme])=>theme),sentiment,analysedCount:items.length};}

export async function POST(request:Request){
  const session=await getManagerSession();
  if(!session||!sameOrigin(request))return json({ok:false},403);
  if(!env.RESEND_API_KEY)return json({ok:false,message:"Email delivery is unavailable."},503);
  const database=db(),now=new Date(),periodEnd=now.toISOString(),periodStart=new Date(now.getTime()-7*86400000).toISOString(),previousStart=new Date(now.getTime()-14*86400000).toISOString();
  const [currentEvents,previousEvents,currentFeedback,previousFeedback,currentReviews,previousReviews,openFeedback,reviewReplies,analysisRows]=await Promise.all([
    database.prepare("SELECT event_type,COUNT(*) count FROM events WHERE business_id=? AND created_at>=? GROUP BY event_type").bind(session.businessId,periodStart).all<Row>(),
    database.prepare("SELECT event_type,COUNT(*) count FROM events WHERE business_id=? AND created_at>=? AND created_at<? GROUP BY event_type").bind(session.businessId,previousStart,periodStart).all<Row>(),
    database.prepare("SELECT id,message,severity,contact_requested FROM feedback WHERE business_id=? AND created_at>=? ORDER BY created_at DESC").bind(session.businessId,periodStart).all<Row>(),
    database.prepare("SELECT COUNT(*) count FROM feedback WHERE business_id=? AND created_at>=? AND created_at<?").bind(session.businessId,previousStart,periodStart).first<Row>(),
    database.prepare("SELECT id,reviewer_name,rating,comment FROM google_reviews WHERE business_id=? AND google_created_at>=? ORDER BY google_created_at DESC").bind(session.businessId,periodStart).all<Row>(),
    database.prepare("SELECT COUNT(*) count,AVG(rating) average FROM google_reviews WHERE business_id=? AND google_created_at>=? AND google_created_at<?").bind(session.businessId,previousStart,periodStart).first<Row>(),
    database.prepare("SELECT message,status,severity,contact_requested,contacted_at,due_at FROM feedback WHERE business_id=? AND status NOT IN ('resolved','archived')").bind(session.businessId).all<AttentionFeedback>(),
    database.prepare("SELECT COUNT(*) count FROM google_reviews WHERE business_id=? AND reply_comment IS NULL AND reply_status!='published'").bind(session.businessId).first<Row>(),
    database.prepare("SELECT source_type,source_id,sentiment,themes FROM ai_analyses WHERE business_id=? AND created_at>=? ORDER BY created_at DESC LIMIT 200").bind(session.businessId,periodStart).all<Row>(),
  ]);
  const currentReviewSummary={count:currentReviews.results.length,average:currentReviews.results.length?currentReviews.results.reduce((sum,row)=>sum+Number(row.rating),0)/currentReviews.results.length:null};
  const open=openFeedback.results,waiting=open.filter(row=>row.contact_requested&&!row.contacted_at).length,flagged=open.filter(row=>row.severity!=="normal").length,otherAttention=open.filter(row=>feedbackNeedsAttention(row,periodEnd)&&!(row.contact_requested&&!row.contacted_at)&&row.severity==="normal").length,reviewsAwaitingReply=Number(reviewReplies?.count??0),attentionCount=open.filter(row=>feedbackNeedsAttention(row,periodEnd)).length+reviewsAwaitingReply;
  const current=metrics(eventCounts(currentEvents.results),currentFeedback.results.length,currentReviewSummary),previous=metrics(eventCounts(previousEvents.results),Number(previousFeedback?.count??0),previousReviews),analysis=analysisSummary(analysisRows.results,currentFeedback.results,currentReviews.results);
  const report=buildWeeklyReport({businessName:session.businessName,businessSlug:session.businessSlug,periodStart,periodEnd,current,previous,awaitingContact:waiting,flagged,reviewsAwaitingReply,attentionCount,otherAttention,feedback:currentFeedback.results.map(row=>({message:String(row.message),severity:String(row.severity),contactRequested:Boolean(row.contact_requested)})),reviews:currentReviews.results.map(row=>({comment:row.comment?String(row.comment):null,rating:Number(row.rating),reviewerName:row.reviewer_name?String(row.reviewer_name):null})),themes:analysis.themes,sentiment:analysis.sentiment,sentimentAnalysed:analysis.analysedCount});
  const snapshot=JSON.stringify({...current,awaitingContact:waiting,flagged,reviewsAwaitingReply,attentionCount,otherAttention});
  try{
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:env.EMAIL_FROM??"StreetVouch <notifications@mail.streetvouch.com>",to:[session.email],subject:report.subject,html:report.html,text:report.text})});
    if(!response.ok)throw new Error(`Email service returned ${response.status}`);
    try{await database.batch([
      database.prepare("INSERT INTO report_deliveries (id,business_id,recipient_email,status,period_start,period_end,snapshot,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),session.businessId,session.email,"queued",periodStart,periodEnd,snapshot,periodEnd),
      database.prepare("UPDATE businesses SET last_report_sent_at=?,report_email=COALESCE(report_email,?) WHERE id=?").bind(periodEnd,session.email,session.businessId),
    ]);}catch(error){console.error("manager_summary_history_failed",error);return json({ok:true,message:"Weekly report accepted for delivery, but its history could not be saved. Check your inbox before retrying."});}
    return json({ok:true,message:"Weekly report accepted for delivery. Check your inbox shortly."});
  }catch(error){
    console.error("manager_summary_failed",error);
    try{await database.prepare("INSERT INTO report_deliveries (id,business_id,recipient_email,status,period_start,period_end,error,snapshot,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),session.businessId,session.email,"failed",periodStart,periodEnd,"Delivery failed",snapshot,periodEnd).run();}catch(historyError){console.error("manager_summary_failure_history_failed",historyError);}
    return json({ok:false,message:"The report could not be sent."},503);
  }
}
