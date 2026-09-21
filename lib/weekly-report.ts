export type WeeklyMetricSet={
  visits:number;
  nfcTaps:number;
  qrScans:number;
  googleClicks:number;
  privateMessages:number;
  newGoogleReviews:number;
  averageRating:number|null;
};

export type WeeklyFeedbackItem={message:string;severity:string;contactRequested:boolean};
export type WeeklyReviewItem={comment:string|null;rating:number;reviewerName:string|null};

export type WeeklyReportInput={
  businessName:string;
  businessSlug:string;
  periodStart:string;
  periodEnd:string;
  current:WeeklyMetricSet;
  previous:WeeklyMetricSet;
  awaitingContact:number;
  flagged:number;
  reviewsAwaitingReply:number;
  feedback:WeeklyFeedbackItem[];
  reviews:WeeklyReviewItem[];
  themes:string[];
  dashboardUrl?:string;
};

const escapeHtml=(value:string)=>value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const formatDate=(value:string)=>new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",timeZone:"Europe/London"}).format(new Date(value));
const plural=(count:number,singular:string,pluralForm=`${singular}s`)=>`${count} ${count===1?singular:pluralForm}`;
const clampText=(value:string,max=180)=>value.length<=max?value:`${value.slice(0,max-1).trimEnd()}…`;

function trend(current:number,previous:number){
  if(current===previous)return{label:"Same as last week",tone:"#5e6d69"};
  if(previous===0)return{label:current>0?"New this week":"No change",tone:current>0?"#315d46":"#5e6d69"};
  const change=Math.round(((current-previous)/previous)*100);
  return{label:`${change>0?"↑":"↓"} ${Math.abs(change)}% vs last week`,tone:change>0?"#315d46":"#8a4b3d"};
}

function metricCard(label:string,value:string,comparison?:ReturnType<typeof trend>){return `<td class="metric" width="50%" style="width:50%;padding:6px;vertical-align:top"><div style="background:#f2f5f1;border:1px solid #e0e7e1;border-radius:12px;padding:18px;min-height:92px"><div style="font-size:28px;line-height:1.1;font-weight:800;color:#17312f">${escapeHtml(value)}</div><div style="font-size:13px;line-height:1.35;color:#53635f;margin-top:6px">${escapeHtml(label)}</div>${comparison?`<div style="font-size:11px;line-height:1.35;color:${comparison.tone};margin-top:7px;font-weight:700">${escapeHtml(comparison.label)}</div>`:""}</div></td>`;}

function stars(rating:number){return `${"★".repeat(Math.max(0,Math.min(5,rating)))}${"☆".repeat(Math.max(0,5-rating))}`;}

export function buildWeeklyReport(input:WeeklyReportInput){
  const url=input.dashboardUrl??`https://go.streetvouch.com/manager/${encodeURIComponent(input.businessSlug)}`;
  const actionCount=input.awaitingContact+input.flagged+input.reviewsAwaitingReply;
  const interactions=input.current.nfcTaps+input.current.qrScans;
  const previousInteractions=input.previous.nfcTaps+input.previous.qrScans;
  const actionHeadline=actionCount===0?"You’re all caught up":`${plural(actionCount,"item")} need${actionCount===1?"s":""} attention`;
  const summary=input.current.newGoogleReviews>0
    ?`${plural(input.current.newGoogleReviews,"new Google review")} and ${plural(input.current.privateMessages,"private message")} arrived this week.`
    :input.current.privateMessages>0
      ?`${plural(input.current.privateMessages,"private message")} arrived this week. No new Google reviews were imported.`
      :"No new customer messages were received this week.";
  const actionRows=[
    input.awaitingContact?`<tr><td style="padding:11px 0;border-bottom:1px solid #ecd9c2"><b>${input.awaitingContact}</b> customer${input.awaitingContact===1?" is":"s are"} waiting for contact</td></tr>`:"",
    input.flagged?`<tr><td style="padding:11px 0;border-bottom:1px solid #ecd9c2"><b>${input.flagged}</b> private message${input.flagged===1?" is":"s are"} flagged for review</td></tr>`:"",
    input.reviewsAwaitingReply?`<tr><td style="padding:11px 0"><b>${input.reviewsAwaitingReply}</b> Google review${input.reviewsAwaitingReply===1?" needs":"s need"} a reply</td></tr>`:"",
  ].join("")||`<tr><td style="padding:11px 0">Nothing is waiting for you. Keep the feedback point visible and continue asking every customer consistently.</td></tr>`;
  const quotes=[
    ...input.reviews.filter(item=>item.comment).slice(0,2).map(item=>({kind:"Google review",meta:`${stars(item.rating)}${item.reviewerName?` · ${item.reviewerName}`:""}`,text:item.comment!})),
    ...input.feedback.slice(0,2).map(item=>({kind:"Private feedback",meta:item.contactRequested?"Reply requested":"Shared privately",text:item.message})),
  ].slice(0,4);
  const quoteHtml=quotes.length?quotes.map(item=>`<div style="border:1px solid #e0e7e1;border-radius:10px;padding:15px 16px;margin:0 0 10px"><div style="font-size:11px;line-height:1.4;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#61706c">${escapeHtml(item.kind)} · ${escapeHtml(item.meta)}</div><div style="font-size:15px;line-height:1.55;color:#243936;margin-top:7px">“${escapeHtml(clampText(item.text))}”</div></div>`).join(""):`<div style="background:#f7f8f6;border-radius:10px;padding:16px;color:#61706c;font-size:14px">There are no new written comments to show this week.</div>`;
  const themeHtml=input.themes.length?input.themes.slice(0,5).map(theme=>`<span style="display:inline-block;background:#edf4e5;border-radius:999px;padding:7px 10px;margin:0 5px 6px 0;font-size:12px;font-weight:700;color:#34503e">${escapeHtml(theme)}</span>`).join(""):"<span style=\"font-size:14px;color:#61706c\">More written feedback is needed before reliable themes can be shown.</span>";
  const insight=actionCount>0
    ?`Start with the ${actionCount===1?"item":"items"} in the attention list, especially any customer who asked to be contacted.`
    :input.current.googleClicks>0&&input.current.newGoogleReviews===0
      ?"Customers opened Google this week, but no new reviews were imported. Check that your Google connection is current and keep the prompt consistent."
      :interactions===0
        ?"No NFC or QR activity was recorded. Check the display is visible, the tag is working and staff know when to present it."
        :"Everything is up to date. Keep the feedback point visible and continue inviting honest feedback consistently.";
  const subject=actionCount>0?`${input.businessName}: ${plural(actionCount,"item")} need attention`:`${input.businessName}: your weekly customer pulse`;
  const preheader=`${summary} ${actionHeadline}.`;
  const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media(max-width:560px){.shell{padding:18px!important}.metric{display:block!important;width:100%!important}.metric div{min-height:auto!important}.hero-title{font-size:29px!important}.hide-mobile{display:none!important}}</style></head><body style="margin:0;background:#edf1ee;font-family:Arial,Helvetica,sans-serif;color:#17312f"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf1ee"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dce4df"><tr><td class="shell" style="padding:32px 34px 18px"><table role="presentation" width="100%"><tr><td style="font-size:20px;font-weight:800;letter-spacing:-.4px"><span style="display:inline-block;background:#c7f66b;border-radius:7px;padding:2px 7px;margin-right:6px">✓</span>streetvouch</td><td align="right" style="font-size:12px;color:#687672">${formatDate(input.periodStart)}–${formatDate(input.periodEnd)}</td></tr></table></td></tr><tr><td class="shell" style="padding:18px 34px 30px;background:#17312f;color:#ffffff"><div style="font-size:11px;letter-spacing:.13em;font-weight:800;color:#c7f66b;text-transform:uppercase">${escapeHtml(input.businessName)} · Weekly pulse</div><h1 class="hero-title" style="font-family:Georgia,serif;font-size:36px;line-height:1.12;font-weight:400;margin:12px 0 10px">${escapeHtml(actionHeadline)}.</h1><p style="font-size:15px;line-height:1.6;color:#dce7e3;margin:0">${escapeHtml(summary)}</p></td></tr><tr><td class="shell" style="padding:26px 28px 6px"><div style="font-size:11px;letter-spacing:.12em;font-weight:800;color:#61706c;text-transform:uppercase;margin:0 6px 9px">This week at a glance</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${metricCard("NFC taps and QR scans",String(interactions),trend(interactions,previousInteractions))}${metricCard("Customer page visits",String(input.current.visits),trend(input.current.visits,input.previous.visits))}</tr><tr>${metricCard("New Google reviews",String(input.current.newGoogleReviews),trend(input.current.newGoogleReviews,input.previous.newGoogleReviews))}${metricCard("Private messages",String(input.current.privateMessages),trend(input.current.privateMessages,input.previous.privateMessages))}</tr></table><p style="font-size:11px;line-height:1.5;color:#73807d;margin:8px 7px 0">${input.current.averageRating===null?"No Google rating average is available for this period.":`New Google reviews averaged ${input.current.averageRating.toFixed(1)} out of 5.`} Google opens and confirmed reviews are measured separately; StreetVouch does not claim that every click became a review.</p></td></tr><tr><td class="shell" style="padding:24px 34px 0"><div style="background:#fff6e8;border:1px solid #f0d9b7;border-radius:12px;padding:19px"><div style="font-size:11px;letter-spacing:.12em;font-weight:800;text-transform:uppercase;color:#8a5a24">Do these first</div><table role="presentation" width="100%" style="font-size:14px;line-height:1.5;color:#513d27;margin-top:6px">${actionRows}</table></div></td></tr><tr><td class="shell" style="padding:28px 34px 0"><div style="font-size:11px;letter-spacing:.12em;font-weight:800;text-transform:uppercase;color:#61706c">Customer voice</div><h2 style="font-size:22px;margin:7px 0 14px">What customers said</h2>${quoteHtml}<p style="font-size:11px;line-height:1.5;color:#73807d;margin:8px 0 0">Private comments are included without customer contact details. Open the secure owner portal for the full conversation and reply controls.</p></td></tr><tr><td class="shell" style="padding:28px 34px 0"><div style="font-size:11px;letter-spacing:.12em;font-weight:800;text-transform:uppercase;color:#61706c">Emerging themes</div><div style="margin-top:11px">${themeHtml}</div></td></tr><tr><td class="shell" style="padding:28px 34px"><div style="background:#edf4e5;border-radius:12px;padding:19px"><div style="font-size:11px;letter-spacing:.12em;font-weight:800;text-transform:uppercase;color:#4f694a">Recommended next step</div><p style="font-size:15px;line-height:1.55;margin:8px 0 0;color:#294333">${escapeHtml(insight)}</p></div><div style="text-align:center;margin-top:26px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#17312f;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:9px;font-size:14px;font-weight:800">Open customer dashboard →</a></div></td></tr><tr><td style="padding:20px 34px;background:#f7f8f6;border-top:1px solid #e0e7e1;font-size:11px;line-height:1.55;color:#73807d">You receive this operational report because you manage ${escapeHtml(input.businessName)}. It contains a limited summary; customer contact information remains in the secure portal.<br><span style="color:#53635f">Feedback made simple with StreetVouch.</span></td></tr></table></td></tr></table></body></html>`;
  const text=`${input.businessName} — weekly customer pulse\n${formatDate(input.periodStart)}–${formatDate(input.periodEnd)}\n\n${actionHeadline}\n${summary}\n\nTHIS WEEK\nNFC taps and QR scans: ${interactions}\nCustomer page visits: ${input.current.visits}\nNew Google reviews: ${input.current.newGoogleReviews}${input.current.averageRating===null?"":` (average ${input.current.averageRating.toFixed(1)}/5)`}\nPrivate messages: ${input.current.privateMessages}\nGoogle page opens: ${input.current.googleClicks}\n\nNEEDS ATTENTION\nCustomers awaiting contact: ${input.awaitingContact}\nFlagged private messages: ${input.flagged}\nGoogle reviews awaiting reply: ${input.reviewsAwaitingReply}\n\nRECOMMENDED NEXT STEP\n${insight}\n\nOpen your dashboard: ${url}\n\nGoogle opens and confirmed reviews are measured separately. Customer contact details remain in the secure portal.`;
  return{subject,preheader,html,text};
}
