import { headers } from "next/headers";
import { adminAllowed, db, json, sameOrigin } from "../../_shared";
export async function POST(request:Request){
  const requestHeaders=await headers(); if(!adminAllowed(requestHeaders))return json({ok:false},403); if(!sameOrigin(request))return json({ok:false},403);
  const body=await request.json() as {id?:string;status?:string}; if(!body.id||!new Set(["new","reviewed","resolved"]).has(body.status??""))return json({ok:false},400);
  const now=new Date().toISOString(),reviewed=body.status==="new"?null:now,resolved=body.status==="resolved"?now:null;
  await db().prepare("UPDATE feedback SET status=?, reviewed_at=?, resolved_at=? WHERE id=?").bind(body.status,reviewed,resolved,body.id).run(); return json({ok:true});
}
