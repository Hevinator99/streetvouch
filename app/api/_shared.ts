import { env } from "cloudflare:workers";

export const BUSINESS = { id: "biz_vbc_01", slug: "village-barbers-cobham", name: "Village Barbers Cobham", googleReviewUrl: "https://www.google.com/search?q=Village+Barbers+Cobham#lrd=0x4875df983e87e645:0xff91360ffce80202,3,,,," };
export function db(): D1Database { if (!env.DB) throw new Error("Database unavailable"); return env.DB; }
export async function ensureBusiness(database: D1Database) {
  await database.prepare(`INSERT OR IGNORE INTO businesses (id, slug, name, google_review_url, owner_email, baseline_google_reviews, current_google_reviews, created_at) VALUES (?, ?, ?, ?, ?, 7, 7, ?)`).bind(BUSINESS.id, BUSINESS.slug, BUSINESS.name, BUSINESS.googleReviewUrl, env.OWNER_EMAIL ?? null, new Date().toISOString()).run();
}
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }); }
export function sameOrigin(request: Request) { const origin = request.headers.get("origin"); if (!origin) return true; try { return new URL(origin).host === new URL(request.url).host; } catch { return false; } }
export async function anonymousKey(request: Request, purpose: string) { const raw = `${purpose}|${new Date().toISOString().slice(0,10)}|${request.headers.get("cf-connecting-ip") ?? "unknown"}|${request.headers.get("user-agent") ?? "unknown"}`; const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)); return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2,"0")).join(""); }
export async function allow(database: D1Database, key: string, limit: number, seconds: number) {
  const now = Math.floor(Date.now()/1000); const row = await database.prepare("SELECT window_start, count FROM rate_limits WHERE key = ?").bind(key).first<{window_start:number;count:number}>();
  if (!row || now-row.window_start>=seconds) { await database.prepare("INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1").bind(key,now).run(); return true; }
  if (row.count>=limit) return false; await database.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run(); return true;
}
export function adminAllowed(headers: Headers) { return headers.get("oai-authenticated-user-id") === "bf16090f-d839-4fe3-af32-985f8f6514e1"; }
