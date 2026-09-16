import { createManagerSession, getPasswordResetSession, hashPassword, hashToken, MANAGER_COOKIE, randomHex } from "../../../manager-auth";
import { cookies } from "next/headers";
import { validManagerPassword } from "../../../../lib/security";
import { db, json, sameOrigin } from "../../_shared";

export async function POST(request:Request){
  const session=await getPasswordResetSession();if(!session||!sameOrigin(request))return json({ok:false,message:"Your password link has expired. Request a new one."},403);
  const body=await request.json() as {password?:string;confirmation?:string},password=body.password??"";
  if(password!==body.confirmation)return json({ok:false,message:"The passwords do not match."},400);
  if(!validManagerPassword(password))return json({ok:false,message:"Use at least 10 characters, including a letter and a number."},400);
  const database=db(),salt=randomHex(),hash=await hashPassword(password,salt),now=new Date().toISOString(),oldToken=(await cookies()).get(MANAGER_COOKIE)?.value;await database.batch([database.prepare("UPDATE manager_users SET password_hash=?,password_salt=?,password_set_at=? WHERE id=? AND business_id=?").bind(hash,salt,now,session.managerUserId,session.businessId),database.prepare("DELETE FROM manager_sessions WHERE manager_user_id=?").bind(session.managerUserId)]);if(oldToken)await database.prepare("DELETE FROM manager_sessions WHERE token_hash=?").bind(await hashToken(oldToken)).run();const token=await createManagerSession(database,session.managerUserId);return new Response(JSON.stringify({ok:true,message:"Password saved."}),{headers:{"Content-Type":"application/json","Cache-Control":"no-store","Set-Cookie":`${MANAGER_COOKIE}=${token}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`}});
}
