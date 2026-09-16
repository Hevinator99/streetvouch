import { anonymousKey, BUSINESS, db, ensureBusiness, json, sameOrigin, allow } from "../_shared";
const allowed = new Set(["page_view", "google_click"]);
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return json({ok:false},403); const body = await request.json() as {event?:string;business?:string;session?:string};
    if (body.business!==BUSINESS.slug || !body.event || !allowed.has(body.event)) return json({ok:false},400);
    const database=db(); await ensureBusiness(database); if (!await allow(database,`track:${await anonymousKey(request,body.event)}`,60,3600)) return json({ok:false},429);
    await database.prepare("INSERT INTO events (id, business_id, event_type, session_id, created_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(),BUSINESS.id,body.event,typeof body.session==="string"?body.session.slice(0,80):null,new Date().toISOString()).run(); return json({ok:true});
  } catch(error) { console.error("tracking_failed",error); return json({ok:false},503); }
}
