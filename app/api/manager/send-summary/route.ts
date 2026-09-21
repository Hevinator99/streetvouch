import { env } from "cloudflare:workers";
import { getManagerSession } from "../../../manager-auth";
import { buildWeeklyReport, type WeeklyMetricSet } from "../../../../lib/weekly-report";
import { db, json, sameOrigin } from "../../_shared";

type Row=Record<string,any>;

function eventCounts(rows:Row[]){return Object.fromEntries(rows.map(row=>[row.event_type,Number(row.count)]));}
function metrics(counts:Record<string,number>,feedbackCount:number,review:Row|null):WeeklyMetricSet{return{
  visits:counts.page_view??0,nfcTaps:counts.nfc_tap??0,qrScans:counts.qr_scan??0,googleClicks:counts.google_click??0,
  privateMessages:feedbackCount,newGoogleReviews:Number(review?.count??0),averageRating:review?.average==null?null:Number(review.average),
};}
function themes(rows:Row[]){const tally=new Map<string,number>();for(const row of rows){try{for(const theme of JSON.parse(row.themes) as string[])tally.set(theme,(tally.get(theme)??0)+1);}catch{}}return[...tally.entries()].sort((a,b)=>b[1]-a[1]).map(([theme])=>theme);}

export async function POST(request:Request){
  const session=await getManagerSession();
  if(!session||!sameOrigin(request))return json({ok:false},403);
  if(!env.RESEND_API_KEY)return json({ok:false,message:"Email delivery is unavailable."},503);
  const database=db(),now=new Date(),periodEnd=now.toISOString(),periodStart=new Date(now.getTime()-7*86400000).toISOString(),previousStart=new Date(now.getTime()-14*86400000).toISOString();
  const [currentEvents,previousEvents,currentFeedback,previousFeedback,currentReviews,previousReviews,outstanding,analysisRows]=await Promise.all([
    database.prepare("SELECT event_type,COUNT(*) count FROM events WHERE business_id=? AND created_at>=? GROUP BY event_type").bind(session.businessId,periodStart).all<Row>(),
    database.prepare("SELECT event_type,COUNT(*) count FROM events WHERE business_id=? AND created_at>=? AND created_at<? GROUP BY event_type").bind(session.businessId,previousStart,periodStart).all<Row>(),
    database.prepare("SELECT message,severity,contact_requested FROM feedback WHERE business_id=? AND created_at>=? ORDER BY created_at DESC LIMIT 20").bind(session.businessId,periodStart).all<Row>(),
    database.prepare("SELECT COUNT(*) count FROM feedback WHERE business_id=? AND created_at>=? AND created_at<?").bind(session.businessId,previousStart,periodStart).first<Row>(),
    database.prepare("SELECT reviewer_name,rating,comment FROM google_reviews WHERE business_id=? AND google_created_at>=? ORDER BY google_created_at DESC LIMIT 20").bind(session.businessId,periodStart).all<Row>(),
    database.prepare("SELECT COUNT(*) count,AVG(rating) average FROM google_reviews WHERE business_id=? AND google_created_at>=? AND google_created_at<?").bind(session.businessId,previousStart,periodStart).first<Row>(),
    database.prepare("SELECT SUM(CASE WHEN contact_requested=1 AND contacted_at IS NULL AND status!='resolved' THEN 1 ELSE 0 END) waiting,SUM(CASE WHEN severity!='normal' AND status!='resolved' THEN 1 ELSE 0 END) flagged,(SELECT COUNT(*) FROM google_reviews WHERE business_id=? AND reply_status!='published') review_replies FROM feedback WHERE business_id=?").bind(session.businessId,session.businessId).first<Row>(),
    database.prepare("SELECT themes FROM ai_analyses WHERE business_id=? AND created_at>=? ORDER BY created_at DESC LIMIT 100").bind(session.businessId,periodStart).all<Row>(),
  ]);
  const currentReviewSummary={count:currentReviews.results.length,average:currentReviews.results.length?currentReviews.results.reduce((sum,row)=>sum+Number(row.rating),0)/currentReviews.results.length:null};
  const current=metrics(eventCounts(currentEvents.results),currentFeedback.results.length,currentReviewSummary),previous=metrics(eventCounts(previousEvents.results),Number(previousFeedback?.count??0),previousReviews);
  const report=buildWeeklyReport({businessName:session.businessName,businessSlug:session.businessSlug,periodStart,periodEnd,current,previous,awaitingContact:Number(outstanding?.waiting??0),flagged:Number(outstanding?.flagged??0),reviewsAwaitingReply:Number(outstanding?.review_replies??0),feedback:currentFeedback.results.map(row=>({message:String(row.message),severity:String(row.severity),contactRequested:Boolean(row.contact_requested)})),reviews:currentReviews.results.map(row=>({comment:row.comment?String(row.comment):null,rating:Number(row.rating),reviewerName:row.reviewer_name?String(row.reviewer_name):null})),themes:themes(analysisRows.results)});
  const snapshot=JSON.stringify({...current,awaitingContact:Number(outstanding?.waiting??0),flagged:Number(outstanding?.flagged??0),reviewsAwaitingReply:Number(outstanding?.review_replies??0)});
  try{
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:env.EMAIL_FROM??"StreetVouch <notifications@mail.streetvouch.com>",to:[session.email],subject:report.subject,html:report.html,text:report.text})});
    if(!response.ok)throw new Error(`Email service returned ${response.status}`);
    await database.batch([
      database.prepare("INSERT INTO report_deliveries (id,business_id,recipient_email,status,period_start,period_end,snapshot,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),session.businessId,session.email,"sent",periodStart,periodEnd,snapshot,periodEnd),
      database.prepare("UPDATE businesses SET last_report_sent_at=?,report_email=COALESCE(report_email,?) WHERE id=?").bind(periodEnd,session.email,session.businessId),
    ]);
    return json({ok:true,message:"Weekly report sent."});
  }catch(error){
    console.error("manager_summary_failed",error);
    await database.prepare("INSERT INTO report_deliveries (id,business_id,recipient_email,status,period_start,period_end,error,snapshot,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),session.businessId,session.email,"failed",periodStart,periodEnd,"Delivery failed",snapshot,periodEnd).run();
    return json({ok:false,message:"The report could not be sent."},503);
  }
}
