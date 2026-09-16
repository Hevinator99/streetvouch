import { getManagerSession } from "../../../manager-auth";
import { decryptToken, googleAccessToken, listGoogleLocations, syncGoogleReviews } from "../../../google";
import { db, sameOrigin } from "../../_shared";

export async function POST(request:Request){
  const manager=await getManagerSession();if(!manager||!sameOrigin(request))return new Response("Forbidden",{status:403});
  const form=await request.formData(),selected=String(form.get("location")??"");
  const database=db(),connection=await database.prepare("SELECT encrypted_refresh_token,token_iv FROM google_connections WHERE business_id=? AND status='pending'").bind(manager.businessId).first<{encrypted_refresh_token:string;token_iv:string}>();
  if(!connection?.encrypted_refresh_token||!connection.token_iv)return Response.redirect(new URL("/manager/village-barbers-cobham?google=failed",request.url),303);
  try{
    const accessToken=await googleAccessToken(await decryptToken(connection.encrypted_refresh_token,connection.token_iv)),locations=await listGoogleLocations(accessToken),location=locations.find(item=>`${item.accountName}|${item.locationName}`===selected);
    if(!location)throw new Error("Selected Google location was not available");
    await database.prepare("UPDATE google_connections SET google_account_name=?,google_location_name=?,google_location_title=?,status='connected',last_error=NULL,updated_at=? WHERE business_id=?").bind(location.accountName,location.locationName,location.title,new Date().toISOString(),manager.businessId).run();
    await syncGoogleReviews(manager.businessId);return Response.redirect(new URL("/manager/village-barbers-cobham?google=connected",request.url),303);
  }catch(error){console.error("google_location_selection_failed",error);await database.prepare("UPDATE google_connections SET status='needs_attention',last_error=?,updated_at=? WHERE business_id=?").bind("Location selection failed",new Date().toISOString(),manager.businessId).run();return Response.redirect(new URL("/manager/village-barbers-cobham?google=failed",request.url),303);}
}
