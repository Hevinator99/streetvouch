import { db, json, sameOrigin } from "../../_shared";
import { createManagerSession, hashPassword, hashToken, MANAGER_COOKIE, randomHex } from "../../../manager-auth";
import { validManagerPassword } from "../../../../lib/security";

export async function POST(request:Request){
  if(!sameOrigin(request))return json({ok:false},403);
  const body=await request.json() as {token?:string;password?:string;confirmation?:string};
  if(!body.token||body.password!==body.confirmation||!validManagerPassword(body.password??""))return json({ok:false,message:"Use matching passwords with at least 10 characters, including a letter and number."},400);
  const database=db(),now=new Date().toISOString(),row=await database.prepare(`SELECT t.manager_user_id managerUserId,mu.business_id businessId,b.slug FROM manager_login_tokens t JOIN manager_users mu ON mu.id=t.manager_user_id JOIN businesses b ON b.id=mu.business_id WHERE t.token_hash=? AND t.purpose='invitation' AND t.used_at IS NULL AND t.expires_at>?`).bind(await hashToken(body.token),now).first<{managerUserId:string;businessId:string;slug:string}>();
  if(!row)return json({ok:false,message:"This invitation is invalid or has expired."},400);
  const salt=randomHex(),passwordHash=await hashPassword(body.password!,salt);
  await database.batch([database.prepare("UPDATE manager_users SET password_hash=?,password_salt=?,password_set_at=?,active=1,invitation_accepted_at=? WHERE id=? AND business_id=?").bind(passwordHash,salt,now,now,row.managerUserId,row.businessId),database.prepare("UPDATE manager_login_tokens SET used_at=? WHERE token_hash=?").bind(now,await hashToken(body.token)),database.prepare("UPDATE onboarding_checks SET manager_account_active=1,updated_at=? WHERE business_id=?").bind(now,row.businessId),database.prepare("DELETE FROM manager_sessions WHERE manager_user_id=?").bind(row.managerUserId)]);
  const session=await createManagerSession(database,row.managerUserId);
  return new Response(JSON.stringify({ok:true,redirect:`/manager/${row.slug}/onboarding`}),{headers:{"Content-Type":"application/json","Cache-Control":"no-store","Set-Cookie":`${MANAGER_COOKIE}=${session}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`}});
}
