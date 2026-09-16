import { cookies } from "next/headers";
import { db } from "../../_shared";
import { hashToken, MANAGER_COOKIE } from "../../../manager-auth";
export async function POST(){const store=await cookies(),token=store.get(MANAGER_COOKIE)?.value;if(token)await db().prepare("DELETE FROM manager_sessions WHERE token_hash=?").bind(await hashToken(token)).run();return new Response(null,{status:303,headers:{Location:"/manager/village-barbers-cobham","Set-Cookie":`${MANAGER_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`}});}
