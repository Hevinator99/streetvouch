import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { getManagerSession } from "../../../manager-auth";
import { decryptToken, googleAccessToken, listGoogleLocations } from "../../../google";
export const dynamic="force-dynamic";

export default async function GoogleLocationPage(){
  const manager=await getManagerSession();if(!manager)redirect("/manager/village-barbers-cobham");
  if(!env.DB)throw new Error("Database unavailable");
  const connection=await env.DB.prepare("SELECT encrypted_refresh_token,token_iv,status FROM google_connections WHERE business_id=?").bind(manager.businessId).first<{encrypted_refresh_token:string;token_iv:string;status:string}>();
  if(!connection?.encrypted_refresh_token||!connection.token_iv||connection.status!=="pending")redirect("/manager/village-barbers-cobham");
  let locations:Array<{accountName:string;locationName:string;title:string}>=[],error="";
  try{locations=await listGoogleLocations(await googleAccessToken(await decryptToken(connection.encrypted_refresh_token,connection.token_iv)));}catch(caught){console.error("google_location_list_failed",caught);error="We couldn’t load your Google locations. Return to the dashboard and reconnect Google.";}
  return <><link rel="stylesheet" href="/manager.css"/><link rel="stylesheet" href="/manager-extra.css"/><main className="manager-login"><div className="login-brand"><span>✓</span>streetvouch</div><div className="login-card location-card"><img src="/village-barbers-logo.jpeg" alt="Village Barbers Cobham"/><span className="kicker">GOOGLE BUSINESS PROFILE</span><h1>Choose the right shop.</h1><p>Select the Google listing that belongs to Village Barbers Cobham. StreetVouch will import and manage reviews only for this location.</p>{error?<p className="manager-status">{error}</p>:<form action="/api/google/select-location" method="post"><fieldset><legend>Available locations</legend>{locations.map((location,index)=><label className="location-choice" key={`${location.accountName}-${location.locationName}`}><input type="radio" name="location" value={`${location.accountName}|${location.locationName}`} required defaultChecked={locations.length===1||index===0}/><span><b>{location.title}</b><small>Google Business Profile</small></span></label>)}</fieldset><button type="submit">Connect this location</button></form>}<a className="location-cancel" href="/manager/village-barbers-cobham">Cancel and return to dashboard</a></div></main></>;
}
