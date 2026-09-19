import { headers } from "next/headers";
import { adminAllowed, db, json, sameOrigin } from "../../_shared";
import { hashToken } from "../../../manager-auth";

export async function POST(request: Request) {
  const h = await headers();
  if (!adminAllowed(h) || !sameOrigin(request)) return json({ ok: false }, 403);
  const body = await request.json() as { businessId?: string; email?: string; displayName?: string; role?: "owner" | "manager" };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!body.businessId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, message: "Enter a valid manager email." }, 400);
  const database = db(), business = await database.prepare("SELECT slug FROM businesses WHERE id=?").bind(body.businessId).first<{slug:string}>();
  if (!business) return json({ ok: false }, 404);
  const existing = await database.prepare("SELECT id FROM manager_users WHERE business_id=? AND email=?").bind(body.businessId, email).first<{id:string}>();
  const managerId = existing?.id ?? crypto.randomUUID(), token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", ""), now = new Date(), expires = new Date(now.getTime() + 7 * 86400000).toISOString();
  const statements = [
    existing ? database.prepare("UPDATE manager_users SET display_name=?,role=?,invited_at=? WHERE id=?").bind(body.displayName ?? null, body.role ?? "owner", now.toISOString(), managerId) : database.prepare("INSERT INTO manager_users (id,business_id,email,display_name,role,active,invited_at,created_at) VALUES (?,?,?,?,?,0,?,?)").bind(managerId, body.businessId, email, body.displayName ?? null, body.role ?? "owner", now.toISOString(), now.toISOString()),
    database.prepare("UPDATE manager_login_tokens SET used_at=? WHERE manager_user_id=? AND purpose='invitation' AND used_at IS NULL").bind(now.toISOString(), managerId),
    database.prepare("INSERT INTO manager_login_tokens (token_hash,manager_user_id,purpose,expires_at,created_at) VALUES (?,?,'invitation',?,?)").bind(await hashToken(token), managerId, expires, now.toISOString()),
  ];
  statements.push(database.prepare("INSERT INTO audit_events (id,business_id,actor_email,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),body.businessId,h.get("oai-authenticated-user-email"),"owner_invited","manager",managerId,"Secure owner invitation created",now.toISOString()));
  await database.batch(statements);
  const invitationUrl = `${new URL(request.url).origin}/manager/invite?token=${encodeURIComponent(token)}`;
  return json({ ok: true, invitationUrl, expiresAt: expires, delivery: "not_sent", message: "Secure invitation created. Copy the link and send it to the manager when ready." });
}
