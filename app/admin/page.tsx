import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Script from "next/script";
import { BUSINESS, ensureBusiness } from "../api/_shared";
export const dynamic="force-dynamic";
type Feedback={id:string;customer_name:string|null;customer_email:string|null;message:string;contact_requested:number;severity:string;status:string;created_at:string};
export default async function AdminPage(){
  const h=await headers(),userId=h.get("oai-authenticated-user-id");if(!userId)redirect("/signin-with-chatgpt?return_to=%2Fadmin");if(userId!=="bf16090f-d839-4fe3-af32-985f8f6514e1")return <main className="admin-denied">
<h1>Access restricted</h1>
<p>This management page is available only to the StreetVouch pilot administrator.</p>
</main>;
  if(!env.DB)throw new Error("Database unavailable");await ensureBusiness(env.DB);const since=new Date(Date.now()-7*86400000).toISOString();
  const [feedbackResult,eventResult,business]=await Promise.all([env.DB.prepare("SELECT * FROM feedback WHERE business_id=? ORDER BY created_at DESC LIMIT 250").bind(BUSINESS.id).all<Feedback>(),env.DB.prepare("SELECT event_type,COUNT(*) count FROM events WHERE business_id=? AND created_at>=? GROUP BY event_type").bind(BUSINESS.id,since).all<{event_type:string;count:number}>(),env.DB.prepare("SELECT baseline_google_reviews,current_google_reviews FROM businesses WHERE id=?").bind(BUSINESS.id).first<{baseline_google_reviews:number;current_google_reviews:number}>()]);
  const counts=Object.fromEntries(eventResult.results.map(r=>[r.event_type,r.count]));const items=feedbackResult.results;const newCount=items.filter(x=>x.status==="new").length,contact=items.filter(x=>x.contact_requested).length,serious=items.filter(x=>x.severity==="serious").length,googleGain=(business?.current_google_reviews??7)-(business?.baseline_google_reviews??7);
  return <>

<link rel="stylesheet" href="/admin.css"/>
<link rel="stylesheet" href="/admin-extra.css"/>
<main className="admin-shell">
<header>
<div>
<span className="admin-brand">✓ streetvouch</span>
<p>Pilot management</p>
</div>
<a href="/signout-with-chatgpt?return_to=%2F">Sign out</a>
</header>
<section className="admin-title">
<div>
<span>VILLAGE BARBERS COBHAM</span>
<h1>Customer pulse</h1>
<p>Last seven days and all private feedback.</p>
</div>
<div className="title-actions">
<button id="send-summary" className="export">Email weekly summary</button>
<a className="export" href="/api/admin/export">Export CSV</a>
</div>
</section>
<p id="admin-status" className="admin-status" role="status"></p>
<section className="metrics">
<article>
<b>{counts.page_view??0}</b>
<span>Page visits</span>
</article>
<article>
<b>{counts.google_click??0}</b>
<span>Google-review clicks</span>
</article>
<article>
<b>{counts.private_submission??0}</b>
<span>Private submissions</span>
</article>
<article>
<b>{counts.contact_request??0}</b>
<span>Contact requests</span>
</article>
<article>
<b>{googleGain}</b>
<span>New Google reviews</span>
</article>
</section>
<section className="summary">
<div>
<span>WEEKLY SUMMARY</span>
<h2>{items.length?`${newCount} feedback item${newCount===1?"":"s"} awaiting review.`:"No private feedback yet."}</h2>
<p>{serious?`${serious} potentially serious item${serious===1?"":"s"} flagged. `:""}{contact?`${contact} customer${contact===1?" has":"s have"} requested contact.`:"No customers are currently waiting for contact."}</p>
</div>
<form id="review-count">
<label htmlFor="count">Current Google review count</label>
<div>
<input id="count" name="count" type="number" min="0" defaultValue={business?.current_google_reviews??7}/>
<button>Update</button>
</div>
<small>Update weekly to measure reviews gained during the pilot.</small>
</form>
</section>
<section className="feedback-list">
<div className="list-head">
<div>
<span>PRIVATE FEEDBACK</span>
<h2>Inbox</h2>
</div>
<div className="filters">
<button data-filter="all" className="active">All</button>
<button data-filter="new">New</button>
<button data-filter="attention">Flagged</button>
</div>
</div>{items.length===0?<div className="empty">Feedback will appear here as soon as a customer submits it.</div>:items.map(item=>
<article className="feedback-card" data-status={item.status} data-severity={item.severity} key={item.id}>
<div className="feedback-meta">
<span className={`pill ${item.severity}`}>{item.severity}</span>
<span className={`pill status`}>{item.status}</span>
<time>{new Date(item.created_at).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"})}</time>
</div>
<p className="message">{item.message}</p>
<div className="customer">
<span>
<b>{item.customer_name??"Anonymous"}</b>{item.customer_email&&<> · <a href={`mailto:${item.customer_email}`}>{item.customer_email}</a>
</>}</span>{item.contact_requested&&<strong>Reply requested</strong>}</div>
<div className="status-actions">
<button data-id={item.id} data-status="reviewed" disabled={item.status==="reviewed"}>Mark reviewed</button>
<button data-id={item.id} data-status="resolved" disabled={item.status==="resolved"}>Resolve</button>
</div>
</article>)}</section>
</main>
<Script src="/admin.js" strategy="afterInteractive"/>
</>;
}
