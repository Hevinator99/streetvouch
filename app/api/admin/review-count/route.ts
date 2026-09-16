import { headers } from "next/headers";
import { adminAllowed, BUSINESS, db, json, sameOrigin } from "../../_shared";
export async function POST(request:Request){const h=await headers();if(!adminAllowed(h)||!sameOrigin(request))return json({ok:false},403);const body=await request.json() as {count?:number};const count=body.count;if(typeof count!=="number"||!Number.isInteger(count)||count<0||count>100000)return json({ok:false},400);await db().prepare("UPDATE businesses SET current_google_reviews=? WHERE id=?").bind(count,BUSINESS.id).run();return json({ok:true});}
