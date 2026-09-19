import { env } from "cloudflare:workers";
import { getManagerSession, hashToken } from "../../../manager-auth";
import { db } from "../../_shared";
import { encryptToken, listGoogleLocations, syncGoogleReviews } from "../../../google";

const redirect=(request:Request,state:string,slug:string)=>{const path=slug==="village-barbers-cobham"?`/manager/${slug}`:`/manager/${slug}/onboarding`,url=new URL(path,request.url);url.searchParams.set("google",state);return Response.redirect(url,303);};

export async function GET(request:Request){
  const manager=await getManagerSession(),url=new URL(request.url),code=url.searchParams.get("code"),state=url.searchParams.get("state");
  if(!manager||!code||!state)return Response.redirect(new URL("/",request.url),303);
  const database=db(),now=new Date().toISOString(),stateHash=await hashToken(state),saved=await database.prepare("SELECT business_id,manager_user_id FROM google_oauth_states WHERE state_hash=? AND expires_at>?").bind(stateHash,now).first<{business_id:string;manager_user_id:string}>();
  if(!saved||saved.business_id!==manager.businessId||saved.manager_user_id!==manager.managerUserId)return redirect(request,"invalid",manager.businessSlug);
  await database.prepare("DELETE FROM google_oauth_states WHERE state_hash=?").bind(stateHash).run();
  try{
    const redirectUri=`${url.origin}/api/google/callback`,response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID??"",client_secret:env.GOOGLE_CLIENT_SECRET??"",code,grant_type:"authorization_code",redirect_uri:redirectUri})});
    if(!response.ok)throw new Error(`OAuth token exchange failed (${response.status})`);
    const tokens=await response.json() as {access_token?:string;refresh_token?:string};
    if(!tokens.access_token||!tokens.refresh_token)throw new Error("Google did not return offline access");
    const locations=await listGoogleLocations(tokens.access_token);if(!locations.length)throw new Error("No managed Google Business Profile location was found");
    const encrypted=await encryptToken(tokens.refresh_token),timestamp=new Date().toISOString();
    if(locations.length>1){
      await database.prepare(`INSERT INTO google_connections (id,business_id,encrypted_refresh_token,token_iv,status,created_at,updated_at) VALUES (?,?,?,?,'pending',?,?) ON CONFLICT(business_id) DO UPDATE SET google_account_name=NULL,google_location_name=NULL,google_location_title=NULL,encrypted_refresh_token=excluded.encrypted_refresh_token,token_iv=excluded.token_iv,status='pending',last_error=NULL,updated_at=excluded.updated_at`).bind(crypto.randomUUID(),manager.businessId,encrypted.encrypted,encrypted.iv,timestamp,timestamp).run();
      return Response.redirect(new URL(`/manager/${manager.businessSlug}/google-location`,request.url),303);
    }
    const location=locations[0];
    await database.prepare(`INSERT INTO google_connections (id,business_id,google_account_name,google_location_name,google_location_title,encrypted_refresh_token,token_iv,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'connected',?,?) ON CONFLICT(business_id) DO UPDATE SET google_account_name=excluded.google_account_name,google_location_name=excluded.google_location_name,google_location_title=excluded.google_location_title,encrypted_refresh_token=excluded.encrypted_refresh_token,token_iv=excluded.token_iv,status='connected',last_error=NULL,updated_at=excluded.updated_at`).bind(crypto.randomUUID(),manager.businessId,location.accountName,location.locationName,location.title,encrypted.encrypted,encrypted.iv,timestamp,timestamp).run();
    await syncGoogleReviews(manager.businessId);await database.prepare("UPDATE onboarding_checks SET google_connection_tested=1,updated_at=? WHERE business_id=?").bind(new Date().toISOString(),manager.businessId).run();return redirect(request,"connected",manager.businessSlug);
  }catch(error){console.error("google_callback_failed",error);await database.prepare(`INSERT INTO google_connections (id,business_id,status,last_error,created_at,updated_at) VALUES (?,?,'sync_failed',?,?,?) ON CONFLICT(business_id) DO UPDATE SET status='sync_failed',last_error=excluded.last_error,updated_at=excluded.updated_at`).bind(crypto.randomUUID(),manager.businessId,"Google connection or review sync failed",now,now).run();return redirect(request,"failed",manager.businessSlug);}
}
