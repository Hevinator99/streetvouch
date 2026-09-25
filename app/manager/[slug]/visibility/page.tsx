import { getManagerSession } from "../../../manager-auth";
import { db } from "../../../api/_shared";
import { analyticsProperties, searchProperties, visibilityToken } from "../../../visibility-service";
import { diagnoseTraffic, type Daily } from "../../../../lib/visibility";
import { selectOpportunities, type Opportunity } from "../../../../lib/visibility-opportunities";

export const dynamic = "force-dynamic";

type Connection = { status: string; search_property: string | null; analytics_property: string | null; last_error: string | null; last_collected_at: string | null };
type SearchRow = { value: string; clicks: number; impressions: number; position: number | null };
type HealthRow = { url: string; issue: string | null; checked_at: string };
type Profile = { status: string; last_synced_at: string | null; google_location_title: string | null };
type View = "health" | "alerts" | "opportunities" | "ai";
const number = (value: number) => value.toLocaleString("en-GB");
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="v-card"><small>{label}</small><strong>{value}</strong><span>{detail}</span></article>;
}

function SearchTable({ rows, kind }: { rows: SearchRow[]; kind: "query" | "page" }) {
  if (!rows.length) return <p>No measured {kind === "query" ? "searches" : "pages"} in this period.</p>;
  return <div className="v-table"><table><thead><tr><th>{kind === "query" ? "Search" : "Page"}</th><th>Clicks</th><th>Appearances</th><th>Click rate</th><th>Avg. position</th></tr></thead><tbody>{rows.map(row => <tr key={row.value}><td>{row.value}</td><td>{number(row.clicks)}</td><td>{number(row.impressions)}</td><td>{row.impressions ? percent(row.clicks / row.impressions) : "—"}</td><td>{row.position ?? "—"}</td></tr>)}</tbody></table></div>;
}

export default async function Visibility({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug } = await params;
  const query = await searchParams;
  const session = await getManagerSession();
  if (!session) return <main className="sv-vis v-signin"><h1>Sign in to view Visibility</h1><a href={`/manager/${slug}`}>Manager sign in</a></main>;
  if (session.businessSlug !== slug) return <main className="sv-vis v-signin"><h1>Access restricted</h1></main>;

  const database = db(), id = session.businessId, base = `/manager/${slug}/visibility`;
  const view: View = query.view === "alerts" || query.view === "opportunities" || query.view === "ai" ? query.view : "health";
  const days = [7, 28, 90].includes(Number(query.days)) ? Number(query.days) : 28;
  const [connection, settings, daily] = await Promise.all([
    database.prepare("SELECT status,search_property,analytics_property,last_error,last_collected_at FROM visibility_connections WHERE business_id=?").bind(id).first<Connection>(),
    database.prepare("SELECT drop_percent,min_baseline,period_days FROM visibility_settings WHERE business_id=?").bind(id).first<{ drop_percent: number; min_baseline: number; period_days: number }>(),
    database.prepare("SELECT date,search_clicks,search_impressions,search_position_sum,analytics_organic_sessions,ai_referral_sessions FROM visibility_daily WHERE business_id=? ORDER BY date DESC LIMIT 190").bind(id).all<Daily>(),
  ]);

  const rows = daily.results.sort((a, b) => a.date.localeCompare(b.date));
  const end = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  const start = new Date(Date.parse(`${end}T00:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10);
  const previousStart = new Date(Date.parse(`${start}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  const selected = rows.filter(row => row.date >= start && row.date <= end);
  const previous = rows.filter(row => row.date >= previousStart && row.date < start);
  const sum = (items: Daily[], key: "search_clicks" | "search_impressions" | "analytics_organic_sessions" | "ai_referral_sessions") => items.some(row => row[key] !== null) ? items.reduce((total, row) => total + (row[key] ?? 0), 0) : null;
  const clicks = sum(selected, "search_clicks"), impressions = sum(selected, "search_impressions"), sessions = sum(selected, "analytics_organic_sessions"), ai = sum(selected, "ai_referral_sessions");
  const oldClicks = sum(previous, "search_clicks"), oldImpressions = sum(previous, "search_impressions");
  const comparison = (current: number | null, old: number | null) => current === null || old === null || old === 0 ? "Comparison unavailable" : `${current >= old ? "+" : ""}${Math.round((current - old) / old * 100)}% vs previous ${days} days`;
  const alerts = view === "alerts" || view === "opportunities" ? diagnoseTraffic(rows, settings?.period_days ?? 7, settings?.drop_percent ?? 40, settings?.min_baseline ?? 20) : [];

  let health: HealthRow[] = [], profile: Profile | null = null, reviews: { total: number; unanswered: number } | null = null;
  let queries: SearchRow[] = [], pages: SearchRow[] = [], feedbackTotal = 0;
  let opportunities: Opportunity[] = [];
  if (view === "health") {
    const [healthResult, profileResult, reviewResult] = await Promise.all([
      database.prepare("SELECT url,issue,checked_at FROM visibility_health WHERE business_id=? ORDER BY checked_at DESC LIMIT 20").bind(id).all<HealthRow>(),
      database.prepare("SELECT status,last_synced_at,google_location_title FROM google_connections WHERE business_id=?").bind(id).first<Profile>(),
      database.prepare("SELECT COUNT(*) total,SUM(CASE WHEN reply_comment IS NULL THEN 1 ELSE 0 END) unanswered FROM google_reviews WHERE business_id=?").bind(id).first<{ total: number; unanswered: number }>(),
    ]);
    health = healthResult.results; profile = profileResult; reviews = reviewResult;
  }
  if (view === "opportunities") {
    const searchRows = (kind: "query" | "page") => database.prepare("SELECT value,SUM(clicks) clicks,SUM(impressions) impressions,ROUND(SUM(position*impressions)*1.0/NULLIF(SUM(impressions),0)/100,1) position FROM visibility_search_rows WHERE business_id=? AND kind=? AND date>=? AND date<=? GROUP BY value ORDER BY clicks DESC LIMIT 10").bind(id, kind, start, end).all<SearchRow>();
    const [queryResult, pageResult, feedbackResult, priorResult, pairResult] = await Promise.all([
      searchRows("query"), searchRows("page"),
      database.prepare("SELECT COUNT(*) total FROM feedback WHERE business_id=? AND created_at>=?").bind(id, new Date(Date.now() - 90 * 86400000).toISOString()).first<{ total: number }>(),
      database.prepare("SELECT value,SUM(clicks) clicks,SUM(impressions) impressions,NULL position FROM visibility_search_rows WHERE business_id=? AND kind='query' AND date>=? AND date<? GROUP BY value").bind(id, previousStart, start).all<SearchRow>(),
      database.prepare("SELECT value,clicks,impressions FROM visibility_search_rows WHERE business_id=? AND kind='query_page' ORDER BY impressions DESC LIMIT 25000").bind(id).all<{ value: string; clicks: number; impressions: number }>(),
    ]);
    queries = queryResult.results; pages = pageResult.results; feedbackTotal = feedbackResult?.total ?? 0;
    const candidateResult = await database.prepare("SELECT value,SUM(clicks) clicks,SUM(impressions) impressions,NULL position FROM visibility_search_rows WHERE business_id=? AND kind='query' AND date>=? AND date<=? GROUP BY value HAVING SUM(impressions)>=20 ORDER BY impressions DESC LIMIT 500").bind(id, start, end).all<SearchRow>();
    opportunities = selectOpportunities(candidateResult.results, priorResult.results, pairResult.results, days);
  }

  // Account lists require live Google API calls. Load them only when the owner opens configuration.
  const configuring = view === "health" && query.configure === "1" && Boolean(connection);
  let properties: string[] = [], analytics: Array<{ name: string; label: string }> = [], accountError = false;
  if (configuring) {
    try {
      const { token } = await visibilityToken(id);
      [properties, analytics] = await Promise.all([searchProperties(token), analyticsProperties(token).catch(() => [])]);
    } catch { accountError = true; }
  }

  const notices: Record<string, string> = {
    connected: "Google connected. Choose a verified property below.", no_properties: "Google connected, but this account has no verified Search Console properties.",
    refreshed: "Latest complete data collected.", saved: "Alert settings saved.", property_saved: "Search property saved. Select Refresh data.",
    analytics_saved: "Analytics property saved. Select Refresh data.", oauth_unavailable: "Google OAuth is not configured yet.",
    action_failed: "The action failed. Check the selected account and try again.", connection_failed: "Google connection failed. Try again.",
    cancelled: "Google connection was cancelled.", invalid_state: "Connection expired. Try again.",
  };

  return <>
    <link rel="stylesheet" href="/manager-dashboard.css" />
    <link rel="stylesheet" href="/visibility.css" />
    <main className="sv-dashboard sv-vis">
      <header className="sv-header">
        <a className="sv-brand" href={`/manager/${slug}`}><span>✓</span>streetvouch</a>
        <nav aria-label="Manager navigation">
          <a href={`/manager/${slug}`}>Overview</a><a href={`/manager/${slug}?section=inbox`}>Inbox</a>
          <a href={`/manager/${slug}?source=google`}>Google reviews</a><a href={base} aria-current="page">Visibility</a>
          <a href={`/manager/${slug}?section=reports`}>Reports</a>
        </nav>
      </header>
      <div className="v-wrap">
        <div className="v-title"><div><p className="sv-eyebrow">{session.businessName}</p><h1>Visibility</h1><p>See how people find you, spot changes, and decide what to do next.</p></div>
          <form method="get" className="v-period"><input type="hidden" name="view" value={view} /><label htmlFor="visibility-period">Reporting period</label><select id="visibility-period" name="days" defaultValue={days}><option value="7">7 days</option><option value="28">28 days</option><option value="90">90 days</option></select><button type="submit">Apply</button></form>
        </div>
        {query.notice && <p className="v-notice" role="status">{notices[query.notice] ?? "Status updated."}</p>}
        <nav className="v-tabs" aria-label="Visibility views">{([["health", "Health"], ["alerts", "Alerts"], ["opportunities", "Opportunities"], ["ai", "AI Presence"]] as const).map(([key, label]) => <a key={key} href={`${base}?view=${key}&days=${days}`} aria-current={view === key ? "page" : undefined}>{label}</a>)}</nav>

        {view === "health" && <>
          <section className="v-grid" aria-label="Search and traffic metrics">
            <Metric label="Google Search clicks" value={clicks === null ? "—" : number(clicks)} detail={comparison(clicks, oldClicks)} />
            <Metric label="Search appearances" value={impressions === null ? "—" : number(impressions)} detail={comparison(impressions, oldImpressions)} />
            <Metric label="Click-through rate" value={clicks !== null && impressions ? percent(clicks / impressions) : "—"} detail="Clicks ÷ appearances" />
            <Metric label="Average position" value={impressions && selected.some(row => row.search_position_sum !== null && row.search_position_sum !== undefined) ? (selected.reduce((total, row) => total + (row.search_position_sum ?? 0), 0) / impressions / 100).toFixed(1) : "—"} detail="Impression-weighted average" />
            <Metric label="Analytics organic sessions" value={sessions === null ? "—" : number(sessions)} detail="Separate from Search clicks" />
          </section>
          <p className="v-muted">Data through {end}; Google may revise recent days. Blank means unavailable, not zero. Search clicks, sessions and bookings are different measures.</p>
          <section className="v-panel"><div className="v-panel-heading"><h2>Connected sources</h2>{connection && <a href={`${base}?configure=1&days=${days}`} className="v-configure">Choose properties</a>}</div>
            <div className="v-columns"><div><h3>Google Search Console</h3><p>{connection?.search_property ?? "Connect your verified website property."}</p>
              {!connection ? <a className="v-button" href="/api/visibility/connect">Connect Google</a> : configuring && <form action="/api/visibility/settings" method="post"><input type="hidden" name="action" value="property" /><select name="property" aria-label="Search Console property" required defaultValue={connection.search_property ?? ""}><option value="">Select verified property</option>{properties.map(property => <option key={property} value={property}>{property}</option>)}</select><button>Save property</button></form>}
            </div><div><h3>Google Analytics 4</h3><p>{connection?.analytics_property ?? "Choose a property to compare organic sessions with search clicks."}</p>
              {configuring && <form action="/api/visibility/settings" method="post"><input type="hidden" name="action" value="analytics" /><select name="property" aria-label="Analytics property" required defaultValue={connection?.analytics_property ?? ""}><option value="">Select Analytics property</option>{analytics.map(property => <option key={property.name} value={property.name}>{property.label}</option>)}</select><button>Save property</button></form>}
            </div></div>
            {accountError && <p>Google account details could not load. <a href="/api/visibility/connect">Reconnect Google</a> and try again.</p>}
            {connection?.search_property && <form action="/api/visibility/settings" method="post" className="v-refresh"><input type="hidden" name="action" value="refresh" /><button className="v-button">Refresh data</button><small>Last collected: {connection.last_collected_at ?? "never"}</small></form>}
            {connection?.last_error && <p>Collection issue: {connection.last_error}</p>}
          </section>
          <section className="v-panel"><h2>Website checks</h2>{health.length ? <ul>{health.map(row => <li key={row.url}><b>{row.url}</b> — {row.issue ?? "No issue found"} <small>Checked {row.checked_at.slice(0, 10)}</small></li>)}</ul> : <p>No website check has been run yet. Add your website URL in business settings and refresh visibility data.</p>}</section>
          <section className="v-panel"><h2>Google Business Profile</h2><p>{profile?.status === "connected" ? `${profile.google_location_title ?? "Profile"} connected; reviews last synced ${profile.last_synced_at ?? "never"}.` : "Business Profile activity is unavailable until Google Business Profile is connected."}</p><p>{profile?.status === "connected" ? `${reviews?.total ?? 0} imported reviews; ${reviews?.unanswered ?? 0} awaiting reply.` : "Calls, directions, profile views and booking actions are unavailable."} <a href={`/manager/${slug}?source=google`}>Manage reviews</a></p><p>Hours, services and booking links need a separate profile check. StreetVouch will not change them automatically.</p></section>
        </>}

        {view === "alerts" && <><section className="v-panel"><h2>Traffic alerts</h2><p>Rule: compare two complete {settings?.period_days ?? 7}-day periods; alert on a fall of at least {settings?.drop_percent ?? 40}% when the earlier period has at least {settings?.min_baseline ?? 20} visits or clicks. Latest three days are excluded.</p>{alerts.length ? alerts.map(alert => <article className="v-alert" key={alert.title}><h3>{alert.title}</h3><p>{alert.action}</p><small>Comparison period starts {alert.started} · {alert.confidence} confidence</small><details><summary>Evidence</summary><p>{alert.evidence}</p></details></article>) : <p>No substantial change supported by the available complete data. At least two full comparison periods are needed.</p>}</section>
          <section className="v-panel"><h2>Adjust alert rule</h2><form action="/api/visibility/settings" method="post" className="v-settings"><input type="hidden" name="action" value="settings" /><label>Period<select name="periodDays" defaultValue={settings?.period_days ?? 7}><option value="7">7 days</option><option value="14">14 days</option><option value="28">28 days</option></select></label><label>Drop threshold<div className="v-input-suffix"><input type="number" name="dropPercent" min="20" max="90" defaultValue={settings?.drop_percent ?? 40} /><span>%</span></div></label><label>Minimum earlier volume<input type="number" name="minBaseline" min="5" max="1000" defaultValue={settings?.min_baseline ?? 20} /></label><button type="submit">Save rule</button></form></section></>}

        {view === "opportunities" && <><section className="v-panel"><h2>Searches people use</h2><SearchTable rows={queries} kind="query" /></section><section className="v-panel"><h2>Pages people find</h2><SearchTable rows={pages} kind="page" /></section><section className="v-panel"><h2>Draft actions for your review</h2>{!connection?.search_property && <p>Connect a verified website in Health, then collect Search Console data to uncover real searches. You do not need to enter search phrases yourself.</p>}{connection?.search_property && !connection.last_collected_at && <p>Your website is connected. Select Refresh data in Health to collect its first search report.</p>}{opportunities.map(item => <article className="v-opportunity" key={item.query}><h3>{item.title}</h3><p><b>Search:</b> {item.query}</p><p><b>Evidence:</b> {item.evidence}</p><p><b>Likely page:</b> {item.page ?? "Not available from Search Console"}{item.page && <small> Most shown page for this search in the latest collected 90-day window.</small>}</p><p><b>Why it matters:</b> {item.relevance}</p><p><b>Effort:</b> {item.effort}</p><p><b>Next step:</b> {item.nextStep}</p></article>)}{!opportunities.length && connection?.last_collected_at && <p>No search currently meets the minimum evidence rules. StreetVouch requires at least 20 appearances and a meaningful drop, or at least 40 appearances with a click-through rate below 5%.</p>}{!opportunities.length && feedbackTotal >= 5 && <p>There are {feedbackTotal} private messages from the last 90 days. Review their aggregated themes for potential service-page topics; keep customer wording private.</p>}<p className="v-muted">These are review drafts, not guaranteed ranking improvements. Nothing is published automatically.</p></section></>}

        {view === "ai" && <><section className="v-grid"><Metric label="Identifiable AI referral sessions" value={ai === null ? "—" : number(ai)} detail="From connected Analytics source data" /><Metric label="Bing AI citations" value="Unavailable" detail="Connect Bing Webmaster data when supported" /></section><section className="v-panel"><h2>AI presence is directional</h2><p>Referral sessions show visits from identifiable AI sources; they do not measure every mention or recommendation. No answer sampling has been recorded, so StreetVouch cannot report a ranking or market share in AI answers.</p><p>Keep important pages public, crawlable and accurate. Google AI search uses its normal search index. Check your site’s crawler rules before changing them.</p></section></>}
      </div>
    </main>
  </>;
}
