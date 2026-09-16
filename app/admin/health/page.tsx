import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAllowed, BUSINESS, ensureBusiness } from "../../api/_shared";
export const dynamic="force-dynamic";

export default async function HealthPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const h=await headers();if(!h.get("oai-authenticated-user-email"))redirect("/signin-with-chatgpt?return_to=%2Fadmin%2Fhealth");if(!adminAllowed(h))return <main className="admin-denied"><h1>Access restricted</h1></main>;if(!env.DB)throw new Error("Database unavailable");
  await ensureBusiness(env.DB);const params=await searchParams;
  const [failedNotifications,failedReports,connection,lastFeedback]=await Promise.all([
    env.DB.prepare("SELECT COUNT(*) count FROM notifications WHERE status='failed'").first<{count:number}>(),
    env.DB.prepare("SELECT COUNT(*) count FROM report_deliveries WHERE business_id=? AND status='failed'").bind(BUSINESS.id).first<{count:number}>(),
    env.DB.prepare("SELECT status,last_synced_at,last_error FROM google_connections WHERE business_id=?").bind(BUSINESS.id).first<{status:string;last_synced_at:string|null;last_error:string|null}>(),
    env.DB.prepare("SELECT created_at FROM feedback WHERE business_id=? ORDER BY created_at DESC LIMIT 1").bind(BUSINESS.id).first<{created_at:string}>()
  ]);
  const googleHealthy=connection?.status==="connected"&&connection.last_synced_at&&Date.now()-new Date(connection.last_synced_at).getTime()<24*60*60*1000;
  const checks=[
    {label:"Database",ok:true,detail:"Available"},
    {label:"Feedback email delivery",ok:(failedNotifications?.count??0)===0,detail:(failedNotifications?.count??0)?`${failedNotifications?.count} failed notification(s) need attention`:"No recorded failures"},
    {label:"Weekly reports",ok:(failedReports?.count??0)===0,detail:(failedReports?.count??0)?`${failedReports?.count} failed report(s) need attention`:"No recorded failures"},
    {label:"Google review sync",ok:Boolean(googleHealthy),detail:connection?.status==="connected"?(connection.last_synced_at?`Last synced ${new Date(connection.last_synced_at).toLocaleString("en-GB")}`:"Connected but not synced"):"Not connected"}
  ];
  return <><link rel="stylesheet" href="/admin.css"/><link rel="stylesheet" href="/admin-extra.css"/><main className="admin-shell"><header><div><span className="admin-brand">✓ streetvouch</span><p>System health</p></div><a href="/admin">← Back to operations</a></header><section className="admin-title"><div><span>PILOT OPERATIONS</span><h1>System health.</h1><p>A quick view of the services that keep feedback, reports and reviews moving.</p></div>{(failedNotifications?.count??0)>0&&<form action="/api/admin/retry-notifications" method="post"><button className="export" type="submit">Retry failed alerts</button></form>}</section>{params.retried&&<p className="admin-status">Retried and sent {params.retried} alert(s).</p>}{params.retry==="unavailable"&&<p className="admin-status">Email delivery is not configured.</p>}<section className="health-checks">{checks.map(check=><article key={check.label} className={check.ok?"healthy":"attention"}><span>{check.ok?"✓":"!"}</span><div><h2>{check.label}</h2><p>{check.detail}</p></div></article>)}</section><section className="admin-side health-detail"><section><span>LATEST ACTIVITY</span><h2>Customer feedback</h2><p>{lastFeedback?.created_at?`Last received ${new Date(lastFeedback.created_at).toLocaleString("en-GB")}`:"No feedback received yet."}</p></section><section><span>MONITORING URL</span><h2>Uptime checks</h2><p>External monitoring can check <code>/api/health</code>. It returns a healthy response only when the application can reach its database.</p></section></section></main></>;
}
