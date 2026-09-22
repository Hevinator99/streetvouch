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
type Sentiment="positive"|"mixed"|"negative"|"neutral";
type ClassifiedComment={sentiment:Sentiment;category:string;themes:string[];action:boolean};

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
  sentiment?:{positive:number;mixed:number;negative:number;neutral:number};
  sentimentAnalysed?:number;
  dashboardUrl?:string;
};

const escapeHtml=(value:string)=>value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const formatDate=(value:string)=>new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",timeZone:"Europe/London"}).format(new Date(value));
const plural=(count:number,singular:string,pluralForm=`${singular}s`)=>`${count} ${count===1?singular:pluralForm}`;
const clampText=(value:string,max=180)=>value.length<=max?value:`${value.slice(0,max-1).trimEnd()}…`;
const percent=(part:number,total:number)=>total>0?Math.round(part/total*100):0;

function trend(current:number,previous:number){
  if(current===previous)return{label:"Same as last week",tone:"#5e6d69"};
  if(previous===0)return{label:current>0?"New this week":"No change",tone:current>0?"#315d46":"#5e6d69"};
  const change=Math.round(((current-previous)/previous)*100);
  return{label:`${change>0?"↑":"↓"} ${Math.abs(change)}% vs last week`,tone:change>0?"#315d46":"#8a4b3d"};
}

function metricCard(label:string,value:string,accent:string,comparison?:ReturnType<typeof trend>){return `<td class="metric" width="50%" style="width:50%;padding:6px;vertical-align:top"><div style="background:#ffffff;border:1px solid #dfe8e3;border-radius:16px;padding:17px 18px;min-height:98px;box-shadow:0 7px 20px rgba(15,45,41,.06)"><table role="presentation" width="100%"><tr><td><div style="display:inline-block;background:${accent};border-radius:999px;padding:8px 13px;font-size:26px;line-height:1;font-weight:900;color:#102e2a">${escapeHtml(value)}</div></td><td align="right" style="font-size:10px;font-weight:800;color:${comparison?.tone??"#61706c"}">${comparison?escapeHtml(comparison.label):""}</td></tr></table><div style="font-size:13px;line-height:1.35;color:#3f5551;margin-top:13px;font-weight:700">${escapeHtml(label)}</div></div></td>`;}

function stars(rating:number){return `${"★".repeat(Math.max(0,Math.min(5,rating)))}${"☆".repeat(Math.max(0,5-rating))}`;}

export function classifyComment(text:string,rating?:number,contactRequested=false):ClassifiedComment{
  const lower=text.toLowerCase().replace(/[’‘]/g,"'");
  const mild=/\bnot bad\b/.test(lower);
  const positive=mild||(/\b(good|great|excellent|amazing|friendly|nice|love|lovely|perfect|best|happy|recommend|okay|ok)\b/.test(lower.replace(/\bnot\s+(good|great|happy|nice|okay|ok)\b/g,"")))||(rating!==undefined&&rating>=4);
  const negative=!mild&&(/\b(bad|poor|rude|awful|terrible|worst|hate|disappoint\w*|unhappy|refund|complaint|late|delay\w*|hot|cold|uncomfortable)\b/.test(lower)||/\b(won't|wouldn't|will not)\s+(be\s+)?(returning|return|come back|coming back)\b/.test(lower)||/\bnever\s+(again|return|coming back)\b/.test(lower)||(rating!==undefined&&rating<=3));
  const uncertain=/\bnot sure\b/.test(lower),negated=/\bnot\s+(good|great|happy|nice|okay|ok)\b/.test(lower);
  const sentiment:Sentiment=uncertain?"mixed":positive&&(negative||negated)?"mixed":negative||negated?"negative":positive?"positive":"neutral";
  const themes:string[]=[];
  if(/\b(hair|haircut|cut|trim|fade|service quality)\b/.test(lower))themes.push("Haircut quality");
  if(/\b(friendly|nice people|lovely|welcoming|kind)\b/.test(lower))themes.push("Staff friendliness");
  if(/\b(rude|conduct|attitude|unprofessional)\b/.test(lower))themes.push("Staff conduct");
  if(/\b(book|booking|appointment|slot)\b/.test(lower))themes.push("Booking experience");
  if(/\b(wait|late|delay|punctual|on time)\b/.test(lower))themes.push("Waiting time");
  if(/\b(hot|cold|temperature|music|atmosphere|comfort)\b/.test(lower))themes.push("Atmosphere & comfort");
  if(/\b(price|pricing|cost|expensive|cheap|value)\b/.test(lower))themes.push("Pricing & value");
  if(/\b(clean|dirty|hygiene)\b/.test(lower))themes.push("Cleanliness");
  if(/\b(contact|call|reply|get back|communication)\b/.test(lower))themes.push("Customer communication");
  const action=contactRequested||negative||/\b(contact|call|reply|get back|immediately)\b/.test(lower);
  const category=contactRequested||/\b(contact|call|reply|get back)\b/.test(lower)?"Action requested":sentiment==="positive"?(themes.includes("Staff friendliness")?"Service strength":"Positive highlight"):sentiment==="mixed"?"Mixed experience":sentiment==="negative"?"Issue to address":"Neutral or unclear";
  return{sentiment,category,themes:themes.length?themes:["General experience"],action};
}

const sentimentStyle:Record<Sentiment,{bg:string;color:string}>={positive:{bg:"#e6f5d9",color:"#315d46"},mixed:{bg:"#fff0cc",color:"#75531b"},negative:{bg:"#fde3de",color:"#8a3f34"},neutral:{bg:"#e9eeec",color:"#53635f"}};
function labelPill(label:string,bg:string,color:string){return `<span style="display:inline-block;background:${bg};color:${color};border-radius:999px;padding:5px 8px;margin:0 5px 5px 0;font-size:10px;line-height:1;font-weight:900;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(label)}</span>`;}

function barRow(label:string,current:number,previous:number,color:string,max:number){
  const width=current===0?0:Math.max(8,Math.round((current/max)*100));
  const comparison=trend(current,previous);
  return `<tr><td style="padding:8px 0;width:124px;font-size:13px;color:#455955">${escapeHtml(label)}</td><td style="padding:8px 12px"><div style="height:10px;background:#e5ebe7;border-radius:99px;overflow:hidden"><div style="height:10px;width:${width}%;background:${color};border-radius:99px"></div></div></td><td align="right" style="padding:8px 0;width:78px"><div style="font-size:14px;font-weight:800;color:#17312f">${current}</div><div style="font-size:10px;color:${comparison.tone}">${escapeHtml(comparison.label)}</div></td></tr>`;
}

function sentimentBlock(sentiment:NonNullable<WeeklyReportInput["sentiment"]>,analysedCount:number){
  const total=sentiment.positive+sentiment.mixed+sentiment.negative+sentiment.neutral;
  if(!total)return `<div style="background:#f7f8f6;border-radius:12px;padding:18px;color:#61706c;font-size:14px;line-height:1.5">Not enough analysed comments yet to show a reliable sentiment split.</div>`;
  const parts=[
    {label:"Positive",value:sentiment.positive,color:"#79b85a",text:"#315d46"},
    {label:"Mixed",value:sentiment.mixed,color:"#efb44e",text:"#75531b"},
    {label:"Negative",value:sentiment.negative,color:"#e77968",text:"#8a3f34"},
    {label:"Neutral",value:sentiment.neutral,color:"#a7b2ae",text:"#53635f"},
  ];
  const dominant=[...parts].sort((a,b)=>b.value-a.value)[0];
  const segments=parts.filter(part=>part.value).map(part=>`<td width="${Math.round(part.value/total*100)}%" style="height:14px;background:${part.color};font-size:0;line-height:0">&nbsp;</td>`).join("");
  const legendRows=[parts.slice(0,2),parts.slice(2,4)].map(row=>`<tr>${row.map(part=>`<td width="50%" style="padding:12px 6px 0;vertical-align:top"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="padding-right:9px"><span style="display:block;width:10px;height:10px;border-radius:10px;background:${part.color};font-size:0;line-height:0">&nbsp;</span></td><td><span style="font-size:17px;font-weight:900;color:${part.text}">${part.value}</span><span style="font-size:12px;font-weight:700;color:#61706c"> &nbsp;${part.label}</span><div style="font-size:10px;color:#7a8783;margin-top:2px">${percent(part.value,total)}% of written responses</div></td></tr></table></td>`).join("")}</tr>`).join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:0 0 13px"><span style="display:inline-block;background:${dominant.color};color:#17312f;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:900">Overall: ${dominant.label.toLowerCase()}</span><div style="font-size:12px;line-height:1.4;color:#61706c;margin-top:8px">${analysedCount} of ${analysedCount} written responses analysed</div></td></tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:999px;overflow:hidden"><tr>${segments}</tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed">${legendRows}</table><p style="font-size:11px;line-height:1.5;color:#73807d;margin:13px 0 0">Sentiment is an automated interpretation, not a customer score. Read it alongside the comments below.</p>`;
}

function insightTile(value:string,label:string,detail:string,accent:string){
  return `<td width="50%" style="width:50%;padding:5px;vertical-align:top"><div style="border:1px solid #dfe8e3;border-top:4px solid ${accent};border-radius:14px;padding:14px;background:#ffffff;min-height:88px"><div style="font-size:24px;line-height:1;font-weight:900;color:#17312f">${escapeHtml(value)}</div><div style="font-size:12px;line-height:1.35;font-weight:800;color:#34504b;margin-top:8px">${escapeHtml(label)}</div><div style="font-size:10px;line-height:1.4;color:#7a8783;margin-top:4px">${escapeHtml(detail)}</div></div></td>`;
}

export function buildWeeklyReport(input:WeeklyReportInput){
  const url=input.dashboardUrl??`https://app.streetvouch.com/manager/${encodeURIComponent(input.businessSlug)}`;
  const actionCount=input.awaitingContact+input.flagged+input.reviewsAwaitingReply;
  const interactions=input.current.nfcTaps+input.current.qrScans;
  const previousInteractions=input.previous.nfcTaps+input.previous.qrScans;
  const sentiment=input.sentiment??{positive:0,mixed:0,negative:0,neutral:0};
  const sentimentAnalysed=input.sentimentAnalysed??sentiment.positive+sentiment.mixed+sentiment.negative+sentiment.neutral;
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
  const allComments=[
    ...input.feedback.map(item=>({kind:"Private feedback",meta:item.contactRequested?"Reply requested":"Shared privately",text:item.message,rating:undefined,contactRequested:item.contactRequested,classification:classifyComment(item.message,undefined,item.contactRequested)})),
    ...input.reviews.filter(item=>item.comment).map(item=>({kind:"Google review",meta:`${stars(item.rating)}${item.reviewerName?` · ${item.reviewerName}`:""}`,text:item.comment!,rating:item.rating,contactRequested:false,classification:classifyComment(item.comment!,item.rating)})),
  ];
  const quotes=[...allComments].sort((a,b)=>Number(b.classification.action)-Number(a.classification.action)||({negative:3,mixed:2,positive:1,neutral:0}[b.classification.sentiment]-{negative:3,mixed:2,positive:1,neutral:0}[a.classification.sentiment])).slice(0,4);
  const quoteHtml=quotes.length?quotes.map(item=>{const tone=sentimentStyle[item.classification.sentiment];return `<div style="border:1px solid #dfe8e3;border-left:5px solid ${tone.color};border-radius:14px;padding:16px 17px;margin:0 0 10px;background:#ffffff;box-shadow:0 6px 18px rgba(15,45,41,.05)"><div style="font-size:10px;line-height:1.4;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#61706c">${escapeHtml(item.kind)} · ${escapeHtml(item.meta)}</div><div style="margin-top:9px">${labelPill(item.classification.sentiment,tone.bg,tone.color)}${labelPill(item.classification.category,"#edf4e5","#34503e")}${item.classification.action?labelPill("Needs attention","#fff0cc","#75531b"):""}</div><div style="font-size:16px;line-height:1.5;color:#183834;margin-top:5px;font-weight:700">“${escapeHtml(clampText(item.text))}”</div></div>`;}).join(""):`<div style="background:#f7f8f6;border-radius:12px;padding:16px;color:#61706c;font-size:14px">There are no new written comments to show this week.</div>`;
  const categoryOrder=["Positive highlight","Service strength","Issue to address","Mixed experience","Neutral or unclear","Action requested"];
  const categoryCounts=new Map(categoryOrder.map(category=>[category,0]));
  for(const item of allComments)categoryCounts.set(item.classification.category,(categoryCounts.get(item.classification.category)??0)+1);
  const categoryColors:Record<string,string>={"Positive highlight":"#b9f24d","Service strength":"#8fe4d2","Issue to address":"#f19a8b","Mixed experience":"#ffd87a","Neutral or unclear":"#cbd4d0","Action requested":"#b8c5ff"};
  const breakdownHtml=allComments.length?`<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${categoryOrder.map(category=>{const count=categoryCounts.get(category)??0,share=percent(count,allComments.length);return `<tr><td style="padding:8px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="font-size:13px;font-weight:800;color:#425752">${escapeHtml(category)}</td><td align="right" style="font-size:12px;font-weight:900;color:#17312f">${count} · ${share}%</td></tr><tr><td colspan="2" style="padding-top:5px"><div style="height:7px;background:#edf1ef;border-radius:99px;overflow:hidden"><div style="height:7px;width:${share}%;background:${categoryColors[category]};border-radius:99px"></div></div></td></tr></table></td></tr>`;}).join("")}</table>`:`<div style="font-size:14px;color:#61706c">Not enough data yet.</div>`;
  const themeStats=new Map<string,{count:number;positive:number;negative:number;mixed:number;neutral:number}>();
  for(const item of allComments)for(const theme of item.classification.themes){const stat=themeStats.get(theme)??{count:0,positive:0,negative:0,mixed:0,neutral:0};stat.count++;stat[item.classification.sentiment]++;themeStats.set(theme,stat);}
  const rankedThemes=[...themeStats.entries()].sort((a,b)=>b[1].count-a[1].count);
  const recurring=rankedThemes.filter(([,stat])=>stat.count>=2).slice(0,5),oneOff=rankedThemes.filter(([,stat])=>stat.count===1).slice(0,3);
  const themeRows=recurring.map(([theme,stat])=>{const dominant=(["positive","negative","mixed","neutral"] as Sentiment[]).sort((a,b)=>stat[b]-stat[a])[0],palette={positive:{bg:"#edf8e8",accent:"#63a94c",label:"Mostly positive"},negative:{bg:"#fff0ee",accent:"#d76558",label:"Needs attention"},mixed:{bg:"#fff7e5",accent:"#e4a83f",label:"Mixed feedback"},neutral:{bg:"#f0f4f2",accent:"#71817c",label:"Mostly neutral"}}[dominant];return `<tr><td style="padding:5px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${palette.bg};border-radius:14px;border-left:5px solid ${palette.accent}"><tr><td style="padding:14px 15px"><div style="font-size:14px;font-weight:900;color:#17312f">${escapeHtml(theme)}</div><div style="font-size:11px;color:#61706c;margin-top:4px">${palette.label}</div></td><td align="right" style="padding:14px 15px"><span style="display:inline-block;background:#ffffff;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:900;color:#17312f">${stat.count} mentions</span></td></tr></table></td></tr>`;}).join("");
  const themeHtml=recurring.length?`<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${themeRows}</table>${oneOff.length?`<p style="font-size:11px;line-height:1.5;color:#73807d;margin:8px 0 0">One-off observations: ${oneOff.map(([theme])=>escapeHtml(theme)).join(", ")}.</p>`:""}`:`<div style="font-size:14px;line-height:1.5;color:#61706c">Not enough repeated feedback yet to identify a recurring theme.${oneOff.length?` One-off observations: ${oneOff.map(([theme])=>escapeHtml(theme)).join(", ")}.`:""}</div>`;
  const chartMax=Math.max(1,interactions,input.current.visits,input.current.privateMessages,input.current.newGoogleReviews);
  const journeyStages=[{label:"NFC + QR",value:interactions,color:"#b9f24d"},{label:"Page visits",value:input.current.visits,color:"#8fe4d2"},{label:"Google opens",value:input.current.googleClicks,color:"#ffd87a"},{label:"Private feedback",value:input.current.privateMessages,color:"#b8c5ff"},{label:"Confirmed reviews",value:input.current.newGoogleReviews,color:"#efb44e"}];
  const journeyHtml=`<div style="font-size:10px;letter-spacing:.11em;font-weight:900;text-transform:uppercase;color:#6a7975;margin:16px 0 8px">Customer journey · directional</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${journeyStages.map((stage,index)=>`<tr><td style="padding:5px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="30" style="font-size:18px;font-weight:900;color:${stage.color}">${index+1}</td><td style="font-size:13px;font-weight:800;color:#425752">${stage.label}</td><td align="right" style="font-size:18px;font-weight:900;color:#17312f">${stage.value}</td></tr></table></td></tr>`).join("")}</table><p style="font-size:10px;line-height:1.45;color:#73807d;margin:8px 0 0">Google opens and confirmed reviews are separate stages, not a verified conversion path.</p>`;
  const weeklyMax=Math.max(1,input.current.privateMessages,input.previous.privateMessages,input.current.newGoogleReviews,input.previous.newGoogleReviews);
  const weekColumn=(label:string,privateValue:number,reviewValue:number)=>{const privateHeight=privateValue?Math.max(8,Math.round(privateValue/weeklyMax*112)):3,reviewHeight=reviewValue?Math.max(8,Math.round(reviewValue/weeklyMax*112)):3;return `<td width="50%" align="center" style="padding:0 8px;vertical-align:bottom"><table role="presentation" cellspacing="0" cellpadding="0" align="center"><tr><td align="center" style="font-size:12px;font-weight:900;color:#5368c8;padding-bottom:5px">${privateValue}</td><td width="12"></td><td align="center" style="font-size:12px;font-weight:900;color:#24786d;padding-bottom:5px">${reviewValue}</td></tr><tr><td width="34" height="120" valign="bottom"><div style="height:${privateHeight}px;background:#7c8fe5;border-radius:8px 8px 3px 3px"></div></td><td width="12"></td><td width="34" height="120" valign="bottom"><div style="height:${reviewHeight}px;background:#2e8b7d;border-radius:8px 8px 3px 3px"></div></td></tr></table><div style="border-top:1px solid #cfd9d4;padding-top:8px;margin-top:0;font-size:12px;font-weight:800;color:#425752">${label}</div></td>`;};
  const activityChart=`<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${weekColumn("Last week",input.previous.privateMessages,input.previous.newGoogleReviews)}${weekColumn("This week",input.current.privateMessages,input.current.newGoogleReviews)}</tr></table><div style="text-align:center;margin-top:14px;font-size:11px;color:#61706c"><span style="color:#7c8fe5">■</span> Private feedback&nbsp;&nbsp;&nbsp;<span style="color:#2e8b7d">■</span> Confirmed Google reviews</div><p style="font-size:10px;line-height:1.45;color:#73807d;margin:8px 0 0;text-align:center">Each week shows two separate totals.</p>`;
  const feedbackRate=percent(input.current.privateMessages,input.current.visits);
  const googleIntentRate=percent(input.current.googleClicks,input.current.visits);
  const attentionRate=percent(input.flagged,input.current.privateMessages);
  const writtenResponses=input.current.privateMessages+input.current.newGoogleReviews;
  const previousWrittenResponses=input.previous.privateMessages+input.previous.newGoogleReviews;
  const writtenTrend=trend(writtenResponses,previousWrittenResponses);
  const insightGrid=`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:-5px"><tr>${insightTile(input.current.visits?`${feedbackRate}%`:"—","Private feedback rate",input.current.visits?"Private messages per page visit":"No page visits recorded","#b8c5ff")}${insightTile(input.current.visits?`${googleIntentRate}%`:"—","Google intent rate",input.current.visits?"Google opens per page visit":"No page visits recorded","#ffd87a")}</tr><tr>${insightTile(input.current.privateMessages?`${attentionRate}%`:"—","Attention rate",input.current.privateMessages?"Private messages flagged for review":"No private messages received","#e77968")}${insightTile(String(writtenResponses),"Written responses",writtenTrend.label,"#8fe4d2")}</tr></table>`;
  const insight=actionCount>0
    ?`Start with the ${actionCount===1?"item":"items"} in the attention list, especially any customer who asked to be contacted.`
    :input.current.googleClicks>0&&input.current.newGoogleReviews===0
      ?"Customers opened Google this week, but no new reviews were imported. Check that your Google connection is current and keep the prompt consistent."
      :interactions===0
        ?"No NFC or QR activity was recorded. Check the display is visible, the tag is working and staff know when to present it."
        :"Everything is up to date. Keep the feedback point visible and continue inviting honest feedback consistently.";
  const subject=actionCount>0?`${input.businessName}: ${plural(actionCount,"item")} need attention`:`${input.businessName}: your weekly customer pulse`;
  const preheader=`${summary} ${actionHeadline}.`;
  const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media(max-width:560px){.shell{padding-left:18px!important;padding-right:18px!important}.metric{display:block!important;width:100%!important}.metric div{min-height:auto!important}.hero-title{font-size:30px!important}.hide-mobile{display:none!important}}</style></head><body style="margin:0;background:#eaf0ed;font-family:Arial,Helvetica,sans-serif;color:#17312f"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eaf0ed"><tr><td align="center" style="padding:22px 8px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#f9fbfa;border-radius:24px;overflow:hidden;border:1px solid #d4dfd9;box-shadow:0 18px 45px rgba(15,45,41,.12)"><tr><td class="shell" style="padding:24px 32px 18px;background:#0f2d29"><table role="presentation" width="100%"><tr><td style="font-size:19px;font-weight:900;letter-spacing:-.4px;color:#ffffff"><span style="display:inline-block;background:#b9f24d;color:#0f2d29;border-radius:9px;padding:3px 8px;margin-right:7px">✓</span>streetvouch</td><td align="right" style="font-size:11px;color:#b9c9c4">${formatDate(input.periodStart)}–${formatDate(input.periodEnd)}</td></tr></table></td></tr><tr><td class="shell" style="padding:18px 32px 32px;background:#0f2d29;color:#ffffff"><div style="display:inline-block;background:#b9f24d;color:#17312f;border-radius:999px;padding:7px 11px;font-size:10px;letter-spacing:.12em;font-weight:900;text-transform:uppercase">${escapeHtml(input.businessName)} · Weekly pulse</div><h1 class="hero-title" style="font-size:38px;line-height:1.08;font-weight:900;letter-spacing:-1.3px;margin:16px 0 10px">${escapeHtml(actionHeadline)}.</h1><p style="font-size:15px;line-height:1.55;color:#cfddd8;margin:0;max-width:500px">${escapeHtml(summary)}</p></td></tr><tr><td class="shell" style="padding:22px 26px 4px;background:#f9fbfa"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${metricCard("NFC + QR interactions",String(interactions),"#b9f24d",trend(interactions,previousInteractions))}${metricCard("Customer page visits",String(input.current.visits),"#8fe4d2",trend(input.current.visits,input.previous.visits))}</tr><tr>${metricCard("New Google reviews",String(input.current.newGoogleReviews),"#ffd87a",trend(input.current.newGoogleReviews,input.previous.newGoogleReviews))}${metricCard("Private messages",String(input.current.privateMessages),"#b8c5ff",trend(input.current.privateMessages,input.previous.privateMessages))}</tr></table><p style="font-size:10px;line-height:1.5;color:#73807d;margin:8px 8px 0">${input.current.averageRating===null?"No Google rating average is available for this period.":`New Google reviews averaged ${input.current.averageRating.toFixed(1)} out of 5.`} Google opens and confirmed reviews are measured separately.</p></td></tr><tr><td class="shell" style="padding:24px 32px 0"><table role="presentation" width="100%"><tr><td><div style="font-size:10px;letter-spacing:.13em;font-weight:900;text-transform:uppercase;color:#6a7975">Engagement</div><h2 style="font-size:21px;letter-spacing:-.4px;margin:6px 0 13px">Customer activity</h2></td></tr></table><div style="background:#ffffff;border:1px solid #dfe8e3;border-radius:16px;padding:13px 16px">${activityChart}</div></td></tr><tr><td class="shell" style="padding:24px 32px 0"><div style="font-size:10px;letter-spacing:.13em;font-weight:900;text-transform:uppercase;color:#6a7975">Insights</div><h2 style="font-size:21px;letter-spacing:-.4px;margin:6px 0 13px">What changed this week</h2>${insightGrid}<p style="font-size:10px;line-height:1.5;color:#73807d;margin:8px 0 0">Directional signals only. Page visits, Google opens and confirmed reviews are measured separately.</p></td></tr><tr><td class="shell" style="padding:24px 32px 0"><div style="font-size:10px;letter-spacing:.13em;font-weight:900;text-transform:uppercase;color:#6a7975">Sentiment</div><h2 style="font-size:21px;letter-spacing:-.4px;margin:6px 0 13px">What the feedback signals</h2><div style="background:#ffffff;border:1px solid #dfe8e3;border-radius:16px;padding:18px">${sentimentBlock(sentiment,sentimentAnalysed)}</div></td></tr><tr><td class="shell" style="padding:24px 32px 0"><div style="font-size:10px;letter-spacing:.13em;font-weight:900;text-transform:uppercase;color:#6a7975">Feedback breakdown</div><h2 style="font-size:21px;letter-spacing:-.4px;margin:6px 0 13px">How comments were grouped</h2><div style="background:#ffffff;border:1px solid #dfe8e3;border-radius:16px;padding:14px 18px">${breakdownHtml}</div><p style="font-size:10px;line-height:1.5;color:#73807d;margin:8px 0 0">Automated groupings can overlap with sentiment and should be checked against the original comments.</p></td></tr><tr><td class="shell" style="padding:22px 32px 0"><div style="background:#fff4df;border:1px solid #f1d39d;border-radius:16px;padding:18px"><div style="font-size:10px;letter-spacing:.13em;font-weight:900;text-transform:uppercase;color:#875817">Priority actions</div><table role="presentation" width="100%" style="font-size:14px;line-height:1.5;color:#513d27;margin-top:5px">${actionRows}</table></div></td></tr><tr><td class="shell" style="padding:26px 32px 0"><div style="font-size:10px;letter-spacing:.13em;font-weight:900;text-transform:uppercase;color:#6a7975">Customer voice</div><h2 style="font-size:21px;letter-spacing:-.4px;margin:6px 0 13px">What customers said</h2>${quoteHtml}<p style="font-size:10px;line-height:1.5;color:#73807d;margin:8px 0 0">Private comments are shown without contact details. Open the secure portal to review originals and override automated classifications.</p></td></tr><tr><td class="shell" style="padding:24px 32px 0"><div style="font-size:10px;letter-spacing:.13em;font-weight:900;text-transform:uppercase;color:#6a7975">Recurring themes</div><h2 style="font-size:21px;letter-spacing:-.4px;margin:6px 0 13px">What came up more than once</h2><div style="background:#ffffff;border:1px solid #dfe8e3;border-radius:16px;padding:14px 18px">${themeHtml}</div></td></tr><tr><td class="shell" style="padding:24px 32px 30px"><div style="background:#0f2d29;border-radius:18px;padding:20px;color:#ffffff"><div style="font-size:10px;letter-spacing:.13em;font-weight:900;text-transform:uppercase;color:#b9f24d">Recommended next step</div><p style="font-size:15px;line-height:1.55;margin:8px 0 0;color:#e5efeb">${escapeHtml(insight)}</p></div><div style="text-align:center;margin-top:22px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#b9f24d;color:#0f2d29;text-decoration:none;padding:14px 24px;border-radius:999px;font-size:14px;font-weight:900">Open customer dashboard →</a></div></td></tr><tr><td style="padding:18px 32px;background:#eff4f1;border-top:1px solid #dfe8e3;font-size:10px;line-height:1.55;color:#73807d">You receive this report because you manage ${escapeHtml(input.businessName)}. Customer contact information remains in the secure portal.<br><span style="color:#53635f;font-weight:700">StreetVouch · Honest feedback, useful action.</span></td></tr></table></td></tr></table></body></html>`;
  const heroStats=`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px"><tr><td style="padding:12px;background:#183d38;border-radius:12px"><div style="font-size:11px;color:#a9bbb6">Private messages</div><div style="font-size:24px;font-weight:900;color:#ffffff;margin-top:3px">${input.current.privateMessages}</div></td><td width="10"></td><td style="padding:12px;background:#183d38;border-radius:12px"><div style="font-size:11px;color:#a9bbb6">Google reviews</div><div style="font-size:24px;font-weight:900;color:#ffffff;margin-top:3px">${input.current.newGoogleReviews}</div></td></tr></table>`;
  const refinedHtml=html.replace(`<p style="font-size:15px;line-height:1.55;color:#cfddd8;margin:0;max-width:500px">${escapeHtml(summary)}</p>`,`<p style="font-size:15px;line-height:1.55;color:#cfddd8;margin:0;max-width:500px">${escapeHtml(summary)}</p>${heroStats}`).replace(/<tr><td class="shell" style="padding:24px 32px 0"><div[^>]*>Insights<\/div>[\s\S]*?Directional signals only\.[\s\S]*?<\/td><\/tr>/,"");
  const text=`${input.businessName} — weekly customer pulse\n${formatDate(input.periodStart)}–${formatDate(input.periodEnd)}\n\n${actionHeadline}\n${summary}\n\nTHIS WEEK\nNFC taps and QR scans: ${interactions}\nCustomer page visits: ${input.current.visits}\nNew Google reviews: ${input.current.newGoogleReviews}${input.current.averageRating===null?"":` (average ${input.current.averageRating.toFixed(1)}/5)`}\nPrivate messages: ${input.current.privateMessages}\nGoogle page opens: ${input.current.googleClicks}\n\nNEEDS ATTENTION\nCustomers awaiting contact: ${input.awaitingContact}\nFlagged private messages: ${input.flagged}\nGoogle reviews awaiting reply: ${input.reviewsAwaitingReply}\n\nRECOMMENDED NEXT STEP\n${insight}\n\nOpen your dashboard: ${url}\n\nGoogle opens and confirmed reviews are measured separately. Customer contact details remain in the secure portal.`;
  return{subject,preheader,html:refinedHtml,text};
}
