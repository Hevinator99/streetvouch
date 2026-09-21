import { env } from "cloudflare:workers";
import { CustomerPageView, CustomerUnavailable, type CustomerBusiness } from "../customer-page";

export const revalidate=300;

export default async function CustomerBusinessPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  if(!env.DB)return <CustomerUnavailable/>;
  const business=await env.DB.prepare("SELECT id,slug,name,logo_url,category,customer_heading,customer_intro,customer_private_prompt,google_review_url,status,page_approved FROM businesses WHERE slug=? AND status='active' AND page_approved=1").bind(slug).first<CustomerBusiness>();
  return business?<CustomerPageView business={business}/>:<CustomerUnavailable/>;
}
