import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

export const MANAGER_COOKIE = "sv_manager_session";

export async function hashToken(token:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("");}

export type ManagerSession={managerUserId:string;businessId:string;email:string;displayName:string|null;role:string;businessName:string;businessSlug:string};

export async function getManagerSession():Promise<ManagerSession|null>{
  if(!env.DB)return null;const token=(await cookies()).get(MANAGER_COOKIE)?.value;if(!token)return null;const hash=await hashToken(token),now=new Date().toISOString();
  const row=await env.DB.prepare(`SELECT mu.id managerUserId,mu.business_id businessId,mu.email,mu.display_name displayName,mu.role,b.name businessName,b.slug businessSlug FROM manager_sessions ms JOIN manager_users mu ON mu.id=ms.manager_user_id JOIN businesses b ON b.id=mu.business_id WHERE ms.token_hash=? AND ms.expires_at>? AND mu.active=1`).bind(hash,now).first<ManagerSession>();
  if(!row)return null;await env.DB.prepare("UPDATE manager_sessions SET last_seen_at=? WHERE token_hash=?").bind(now,hash).run();return row;
}
