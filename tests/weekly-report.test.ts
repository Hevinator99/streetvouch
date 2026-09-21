import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyReport, type WeeklyReportInput } from "../lib/weekly-report";

const report:WeeklyReportInput={businessName:"Village & Barbers",businessSlug:"village-barbers",periodStart:"2026-09-14T00:00:00.000Z",periodEnd:"2026-09-21T00:00:00.000Z",current:{visits:22,nfcTaps:18,qrScans:2,googleClicks:11,privateMessages:2,newGoogleReviews:3,averageRating:4.7},previous:{visits:11,nfcTaps:8,qrScans:2,googleClicks:6,privateMessages:1,newGoogleReviews:2,averageRating:4.5},awaitingContact:1,flagged:1,reviewsAwaitingReply:2,feedback:[{message:"Please call me <today>",severity:"attention",contactRequested:true}],reviews:[{comment:"Great cut & friendly team",rating:5,reviewerName:"Sam"}],themes:["service","cut quality"]};

test("weekly report prioritises actions and separates clicks from reviews",()=>{
  const result=buildWeeklyReport(report);
  assert.match(result.subject,/4 items need attention/);
  assert.match(result.html,/Google opens and confirmed reviews are measured separately/);
  assert.match(result.text,/Google page opens: 11/);
  assert.match(result.text,/New Google reviews: 3/);
});

test("weekly report escapes customer and business content",()=>{
  const result=buildWeeklyReport(report);
  assert.doesNotMatch(result.html,/Please call me <today>/);
  assert.match(result.html,/Please call me &lt;today&gt;/);
  assert.match(result.html,/Village &amp; Barbers/);
});

test("weekly report has a useful zero-state",()=>{
  const result=buildWeeklyReport({...report,current:{visits:0,nfcTaps:0,qrScans:0,googleClicks:0,privateMessages:0,newGoogleReviews:0,averageRating:null},awaitingContact:0,flagged:0,reviewsAwaitingReply:0,feedback:[],reviews:[],themes:[]});
  assert.match(result.html,/You’re all caught up/);
  assert.match(result.html,/No NFC or QR activity was recorded/);
  assert.match(result.html,/no new written comments/i);
});
