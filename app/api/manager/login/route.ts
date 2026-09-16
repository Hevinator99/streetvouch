import { env } from "cloudflare:workers";
import { allow, anonymousKey, BUSINESS, db, ensureBusiness, sameOrigin } from "../../_shared";
import { createManagerSession, hashPassword, MANAGER_COOKIE, safeEqual } from "../../../manager-auth";

export async function POST(request:Request){
  if(!sameOrigin(request))return Response.json({ok:false,message:"Sign-in could not be completed."},{status:403});
  const body=await request.json() as {email?:string;password?:string;website?:string};if(body.website)return Response.json({ok:false,message:"Email or password is incorrect."},{status:401});
  const email=body.email?.trim().toLowerCase()??"",password=body.password??"",database=db();await ensureBusiness(database);
  const rateKey=`manager-password-login:${await anonymousKey(request,"manager-password-login")}`;if(!await allow(database,rateKey,10,3600))return Response.json({ok:false,message:"Too many attempts. Please try again later."},{status:429});
  const manager=await database.prepare("SELECT id,password_hash,password_salt,active FROM manager_users WHERE business_id=? AND email=?").bind(BUSINESS.id,email).first<{id:string;password_hash:string|null;password_salt:string|null;active:number}>();
  const salt=manager?.password_salt??"streetvouch-invalid-login",expected=manager?.password_hash??"0".repeat(64),actual=await hashPassword(password,salt),valid=Boolean(manager?.active&&manager.password_hash&&manager.password_salt&&safeEqual(actual,expected));
  if(!valid)return Response.json({ok:false,message:"Email or password is incorrect. Use ‘Set up or reset password’ if needed."},{status:401,headers:{"Cache-Control":"no-store"}});
  const token=await createManagerSession(database,manager!.id);return Response.json({ok:true},{headers:{"Set-Cookie":`${MANAGER_COOKIE}=${token}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`,"Cache-Control":"no-store"}});
}
