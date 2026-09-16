import { getManagerSession, hashPassword, randomHex } from "../../../manager-auth";
import { db, json, sameOrigin } from "../../_shared";

export async function POST(request:Request){
  const session=await getManagerSession();if(!session||!sameOrigin(request))return json({ok:false,message:"Your password link has expired. Request a new one."},403);
  const body=await request.json() as {password?:string;confirmation?:string},password=body.password??"";
  if(password!==body.confirmation)return json({ok:false,message:"The passwords do not match."},400);
  if(password.length<10||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))return json({ok:false,message:"Use at least 10 characters, including a letter and a number."},400);
  const salt=randomHex(),hash=await hashPassword(password,salt),now=new Date().toISOString();await db().prepare("UPDATE manager_users SET password_hash=?,password_salt=?,password_set_at=? WHERE id=? AND business_id=?").bind(hash,salt,now,session.managerUserId,session.businessId).run();return json({ok:true,message:"Password saved."});
}
