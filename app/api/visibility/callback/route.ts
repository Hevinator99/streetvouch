import { env } from "cloudflare:workers";
import { getManagerSession, hashToken } from "../../../manager-auth";
import { db } from "../../_shared";
import { encryptToken } from "../../../google";
import { searchProperties } from "../../../visibility-service";

export async function GET(request: Request) {
  const session = await getManagerSession();
  if (!session) return Response.redirect(new URL("/", request.url), 303);
  const url = new URL(request.url), back = new URL(`/manager/${session.businessSlug}/visibility`, url);
  const state = url.searchParams.get("state"), code = url.searchParams.get("code");
  if (!state || !code) { back.searchParams.set("notice", "cancelled"); return Response.redirect(back, 303); }
  const database = db(), stateHash = await hashToken(state);
  const row = await database.prepare("SELECT business_id,manager_user_id FROM visibility_oauth_states WHERE state_hash=? AND expires_at>?").bind(stateHash, new Date().toISOString()).first<{ business_id: string; manager_user_id: string }>();
  if (!row || row.business_id !== session.businessId || row.manager_user_id !== session.managerUserId) { back.searchParams.set("notice", "invalid_state"); return Response.redirect(back, 303); }
  await database.prepare("DELETE FROM visibility_oauth_states WHERE state_hash=?").bind(stateHash).run();
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID ?? "", client_secret: env.GOOGLE_CLIENT_SECRET ?? "", code, grant_type: "authorization_code", redirect_uri: `${url.origin}/api/visibility/callback` }) });
    if (!response.ok) throw new Error(`Token exchange ${response.status}`);
    const token = await response.json() as { access_token?: string; refresh_token?: string };
    if (!token.access_token || !token.refresh_token) throw new Error("Offline access unavailable");
    const properties = await searchProperties(token.access_token), encrypted = await encryptToken(token.refresh_token), now = new Date().toISOString();
    await database.batch([
      database.prepare("DELETE FROM visibility_daily WHERE business_id=?").bind(session.businessId),
      database.prepare("DELETE FROM visibility_search_rows WHERE business_id=?").bind(session.businessId),
      database.prepare("DELETE FROM visibility_health WHERE business_id=?").bind(session.businessId),
      database.prepare(`INSERT INTO visibility_connections (business_id,encrypted_refresh_token,token_iv,status,updated_at) VALUES (?,?,?,'connected',?) ON CONFLICT(business_id) DO UPDATE SET encrypted_refresh_token=excluded.encrypted_refresh_token,token_iv=excluded.token_iv,search_property=NULL,analytics_property=NULL,last_collected_at=NULL,status='connected',last_error=NULL,updated_at=excluded.updated_at`).bind(session.businessId, encrypted.encrypted, encrypted.iv, now),
    ]);
    back.searchParams.set("notice", properties.length ? "connected" : "no_properties");
  } catch (error) { console.error("visibility_oauth_failed", error); back.searchParams.set("notice", "connection_failed"); }
  return Response.redirect(back, 303);
}
