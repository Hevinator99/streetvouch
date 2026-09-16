import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

export const MANAGER_COOKIE = "sv_manager_session";
const PASSWORD_ITERATIONS = 100000;

export async function hashToken(token:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("");}
export function randomHex(bytes=16){const values=crypto.getRandomValues(new Uint8Array(bytes));return [...values].map(v=>v.toString(16).padStart(2,"0")).join("");}
export async function hashPassword(password:string,salt:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:new TextEncoder().encode(salt),iterations:PASSWORD_ITERATIONS},key,256);return [...new Uint8Array(bits)].map(v=>v.toString(16).padStart(2,"0")).join("");}
export function safeEqual(left:string,right:string){if(left.length!==right.length)return false;let result=0;for(let i=0;i<left.length;i++)result|=left.charCodeAt(i)^right.charCodeAt(i);return result===0;}
export async function createManagerSession(database:D1Database,managerUserId:string){const now=new Date(),token=crypto.randomUUID()+crypto.randomUUID().replaceAll("-",""),hash=await hashToken(token),expires=new Date(now.getTime()+7*86400000).toISOString();await database.prepare("INSERT INTO manager_sessions (token_hash,manager_user_id,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?)").bind(hash,managerUserId,expires,now.toISOString(),now.toISOString()).run();return token;}

export type ManagerSession={managerUserId:string;businessId:string;email:string;displayName:string|null;role:string;businessName:string;businessSlug:string};

export async function getManagerSession():Promise<ManagerSession|null>{
  if(!env.DB)return null;const token=(await cookies()).get(MANAGER_COOKIE)?.value;if(!token)return null;const hash=await hashToken(token),now=new Date().toISOString();
  const row=await env.DB.prepare(`SELECT mu.id managerUserId,mu.business_id businessId,mu.email,mu.display_name displayName,mu.role,b.name businessName,b.slug businessSlug FROM manager_sessions ms JOIN manager_users mu ON mu.id=ms.manager_user_id JOIN businesses b ON b.id=mu.business_id WHERE ms.token_hash=? AND ms.expires_at>? AND mu.active=1`).bind(hash,now).first<ManagerSession>();
  if(!row)return null;await env.DB.prepare("UPDATE manager_sessions SET last_seen_at=? WHERE token_hash=?").bind(now,hash).run();return row;
}
