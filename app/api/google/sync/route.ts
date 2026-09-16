import { getManagerSession } from "../../../manager-auth";
import { syncGoogleReviews } from "../../../google";
export async function GET(request:Request){const manager=await getManagerSession();if(!manager)return Response.redirect(new URL("/manager/village-barbers-cobham",request.url),303);try{await syncGoogleReviews(manager.businessId);return Response.redirect(new URL("/manager/village-barbers-cobham?google=synced",request.url),303);}catch(error){console.error("google_sync_failed",error);return Response.redirect(new URL("/manager/village-barbers-cobham?google=failed",request.url),303);}}
