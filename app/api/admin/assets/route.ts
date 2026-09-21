import { headers } from "next/headers";
import { adminAllowed, db, json, sameOrigin } from "../../_shared";

export async function POST(request: Request) {
  const h = await headers();
  if (!adminAllowed(h) || !sameOrigin(request)) return json({ ok: false }, 403);
  const body = await request.json() as { businessId?:string; label?:string; placement?:string; assetType?:string };
  const allowed = new Set(["counter","barber_station","window","card","other"]);
  if (!body.businessId || !body.label?.trim() || !body.placement?.trim() || !allowed.has(body.assetType ?? "")) return json({ok:false,message:"Add a label, placement and asset type."},400);
  const database=db(), business=await database.prepare("SELECT slug FROM businesses WHERE id=?").bind(body.businessId).first<{slug:string}>();if(!business)return json({ok:false},404);
  const id=crypto.randomUUID(),token=crypto.randomUUID().replaceAll("-","").slice(0,16),now=new Date().toISOString();
  await database.prepare("INSERT INTO business_assets (id,business_id,token,label,placement,asset_type,active,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)").bind(id,body.businessId,token,body.label.trim().slice(0,100),body.placement.trim().slice(0,160),body.assetType,now,now).run();
  await database.prepare("INSERT INTO audit_events (id,business_id,actor_email,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),body.businessId,h.get("oai-authenticated-user-email"),"asset_created","asset",id,body.label.trim(),now).run();
  const base=`https://go.streetvouch.com/t/${token}`;
  return json({ok:true,id,token,nfcUrl:`${base}?channel=nfc`,qrUrl:`${base}?channel=qr`,qrPayload:`${base}?channel=qr`,message:"Asset created. Encode and test both URLs before activation."});
}
