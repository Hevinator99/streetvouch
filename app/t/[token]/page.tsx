import { env } from "cloudflare:workers";
import { CustomerPageView, CustomerUnavailable, type CustomerBusiness } from "../../customer/customer-page";

export const revalidate=300;

type AssetCustomerBusiness=CustomerBusiness&{asset_id:string};

export default async function AssetEntry({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const {token}=await params,query=await searchParams;
  if(!env.DB)return <CustomerUnavailable/>;
  const business=await env.DB.prepare(`SELECT ba.id asset_id,b.id,b.slug,b.name,b.logo_url,b.category,b.customer_heading,b.customer_intro,b.customer_private_prompt,b.google_review_url,b.status,b.page_approved FROM business_assets ba JOIN businesses b ON b.id=ba.business_id WHERE ba.token=? AND ba.active=1 AND b.status='active' AND b.page_approved=1`).bind(token).first<AssetCustomerBusiness>();
  if(!business)return <CustomerUnavailable/>;
  const channel=query.channel==='qr'?'qr':'nfc';
  return <CustomerPageView business={business} asset={business.asset_id} entryChannel={channel}/>;
}
