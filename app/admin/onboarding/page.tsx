import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAllowed,db } from "../../api/_shared";
export const dynamic="force-dynamic";
export default async function SetupRedirect({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const h=await headers();if(!h.get("oai-authenticated-user-email"))redirect("/signin-with-chatgpt?return_to=%2Fadmin");if(!adminAllowed(h))return <h1>Access restricted</h1>;
 const p=await searchParams;const b=p.business?await db().prepare("SELECT id FROM businesses WHERE slug=?").bind(p.business).first<{id:string}>():null;
 redirect(b?`/admin?view=business&business=${encodeURIComponent(b.id)}&tab=setup`:"/admin?view=businesses");
}
