import SiteShell from "../site-shell";
import { headers } from "next/headers";
import ManagerDashboard from "../manager/village-barbers-cobham/page";
export const dynamic="force-dynamic";
export default async function CustomerPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) { const host=(await headers()).get("host")??"";if(host.startsWith("app.streetvouch.com"))return <ManagerDashboard searchParams={searchParams}/>;return <SiteShell />; }
