import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { getManagerSession } from "../../../manager-auth";
import { adminAllowed } from "../../../api/_shared";
import { CustomerPageView, CustomerUnavailable, type CustomerBusiness } from "../../customer-page";

export const dynamic="force-dynamic";

export default async function CustomerBusinessPreview({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params,session=await getManagerSession(),requestHeaders=await headers();
  if(session?.businessSlug!==slug&&!adminAllowed(requestHeaders))return <CustomerUnavailable/>;
  if(!env.DB)return <CustomerUnavailable/>;
  const business=await env.DB.prepare("SELECT id,slug,name,logo_url,category,customer_heading,customer_intro,customer_private_prompt,google_review_url,status,page_approved FROM businesses WHERE slug=?").bind(slug).first<CustomerBusiness>();
  return business?<CustomerPageView business={business} test/>:<CustomerUnavailable/>;
}
