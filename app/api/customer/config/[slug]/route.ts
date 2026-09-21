import { env } from "cloudflare:workers";

type Config={name:string;category:string|null;customer_heading:string;customer_intro:string;customer_private_prompt:string;google_review_url:string;logo_url:string|null};

export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  if(!env.DB)return Response.json({ok:false},{status:503});
  const business=await env.DB.prepare("SELECT name,category,customer_heading,customer_intro,customer_private_prompt,google_review_url,logo_url FROM businesses WHERE slug=? AND status='active' AND page_approved=1").bind(slug).first<Config>();
  if(!business)return Response.json({ok:false},{status:404});
  return Response.json({ok:true,...business},{headers:{"Cache-Control":"public, max-age=60, stale-while-revalidate=300","Cloudflare-CDN-Cache-Control":"public, s-maxage=60, stale-while-revalidate=300"}});
}
