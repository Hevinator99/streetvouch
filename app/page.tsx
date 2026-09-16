import SiteShell from "./site-shell";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
export const dynamic="force-dynamic";
export default async function Home() { const host=(await headers()).get("host")??"";if(host.startsWith("app.streetvouch.com"))redirect("/village-barbers-cobham");return <SiteShell />; }
