import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import Script from "next/script";
import { getManagerSession } from "../../../manager-auth";

export const dynamic = "force-dynamic";

type Item = {
  source_type: "feedback" | "google_review"; source_id: string; customer: string;
  text: string; rating: number | null; created_at: string; urgency: string | null;
  confidence: number | null; sentiment: string | null; themes: string | null;
  recommended_action: string | null; draft_reply: string | null;
  rationale: string | null; model: string | null;
};

export default async function InsightsPage() {
  const session = await getManagerSession();
  if (!session) redirect("/manager/village-barbers-cobham");
  const result = await env.DB.prepare(`
    SELECT 'feedback' source_type, f.id source_id, COALESCE(f.customer_name, 'Anonymous') customer,
      f.message text, NULL rating, f.created_at, a.urgency, a.confidence, a.sentiment, a.themes,
      a.recommended_action, a.draft_reply, a.rationale, a.model
    FROM feedback f LEFT JOIN ai_analyses a ON a.business_id=f.business_id
      AND a.source_type='feedback' AND a.source_id=f.id WHERE f.business_id=?
    UNION ALL
    SELECT 'google_review' source_type, g.id source_id, COALESCE(g.reviewer_name, 'Google customer') customer,
      COALESCE(g.comment, 'Rating only') text, g.rating, g.google_created_at created_at,
      a.urgency, a.confidence, a.sentiment, a.themes, a.recommended_action, a.draft_reply, a.rationale, a.model
    FROM google_reviews g LEFT JOIN ai_analyses a ON a.business_id=g.business_id
      AND a.source_type='google_review' AND a.source_id=g.id WHERE g.business_id=?
    ORDER BY created_at DESC LIMIT 100
  `).bind(session.businessId, session.businessId).all<Item>();
  const items = result.results;
  const urgent = items.filter(item => item.urgency === "urgent" || item.urgency === "critical").length;
  const unanalyzed = items.filter(item => !item.model).length;

  return <>
    <link rel="stylesheet" href="/manager.css" /><link rel="stylesheet" href="/manager-extra.css" />
    <main className="manager-shell">
      <header className="manager-header"><a className="manager-brand" href="/manager/village-barbers-cobham"><span>✓</span>streetvouch</a><a className="manager-secondary" href="/manager/village-barbers-cobham">← Dashboard</a></header>
      <section className="manager-hero compact"><div><span className="kicker">ASSISTED INSIGHTS</span><h1>Customer intelligence.</h1><p>StreetVouch highlights what matters and drafts a response. Nothing is sent without a manager.</p></div><div className="ai-summary"><b>{urgent}</b><span>urgent</span><b>{unanalyzed}</b><span>awaiting analysis</span></div></section>
      <p id="ai-status" className="manager-status" role="status"></p>
      <section className="manager-content">
        <div className="content-heading"><div><span className="kicker">REVIEWS & PRIVATE FEEDBACK</span><h2>Analysis queue</h2></div><small>Human approval always required</small></div>
        {items.length === 0 ? <div className="manager-empty">No customer feedback to analyse yet.</div> : <div className="manager-list">{items.map(item =>
          <article className="manager-feedback ai-item" key={`${item.source_type}-${item.source_id}`}>
            <div className="feedback-top"><span className="pill status">{item.source_type === "google_review" ? "Google review" : "Private feedback"}</span>{item.rating && <span className="stars">{"★".repeat(item.rating)}{"☆".repeat(5-item.rating)}</span>}<time>{new Date(item.created_at).toLocaleDateString("en-GB")}</time></div>
            <p>{item.text}</p><div className="feedback-person"><b>{item.customer}</b></div>
            {item.model ? <div className="ai-analysis">
              <div className="ai-analysis-head"><span className={`ai-urgency ${item.urgency}`}>{item.urgency}</span><span>{item.confidence}% confidence</span><span>{item.sentiment}</span></div>
              <p><b>Themes:</b> {safeThemes(item.themes).join(", ")}</p><p><b>Next action:</b> {item.recommended_action}</p>
              <label>Suggested reply<textarea readOnly defaultValue={item.draft_reply ?? ""} /></label>
              <div className="ai-actions"><button className="manager-secondary ai-copy">Copy reply</button>{item.source_type === "google_review" && <a className="manager-secondary" href="/manager/village-barbers-cobham#reviews">Review and publish</a>}</div>
              <details><summary>Why it was classified this way</summary><p>{item.rationale}</p><small>{item.model === "streetvouch-rules-v1" ? "Safety rules engine" : "AI-assisted analysis"}</small></details>
            </div> : <button className="manager-primary ai-analyse" data-source-type={item.source_type} data-source-id={item.source_id}>Analyse feedback</button>}
          </article>)}</div>}
      </section>
    </main><Script src="/ai-insights.js" strategy="afterInteractive" />
  </>;
}

function safeThemes(value: string | null) {
  try { const parsed = JSON.parse(value ?? "[]"); return Array.isArray(parsed) ? parsed.map(String) : []; }
  catch { return []; }
}
