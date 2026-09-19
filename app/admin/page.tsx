import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAllowed } from "../api/_shared";
import Workspace from "./workspace";
export const dynamic="force-dynamic";
export default async function AdminPage(){
  const h=await headers();
  if(!h.get("oai-authenticated-user-email"))redirect("/signin-with-chatgpt?return_to=%2Fadmin");
  if(!adminAllowed(h))return <main><h1>Access restricted</h1><p>This workspace is reserved for the StreetVouch operator.</p></main>;
  return <><link rel="stylesheet" href="/operator.css"/><Workspace/></>;
}
