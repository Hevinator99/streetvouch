import Script from "next/script";
import { getManagerSession } from "../../manager-auth";
import Dashboard from "../dashboard";
export const dynamic="force-dynamic";
export default async function OwnerPortal({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|undefined>>}){
 const {slug}=await params,query=await searchParams,session=await getManagerSession();
 if(!session)return <SignIn slug={slug}/>;
 if(session.businessSlug!==slug)return <main><h1>Access restricted</h1><p>This account cannot access another business.</p></main>;
 return <Dashboard session={session} query={query}/>;
}

function SignIn({slug}:{slug:string}){return <><link rel="stylesheet" href="/manager.css"/><main className="manager-login"><div className="login-brand"><span>✓</span>streetvouch</div><div className="login-card"><span className="kicker">BUSINESS OWNER PORTAL</span><h1>Sign in.</h1><p>Access your private messages, Google reviews, analysis and account setup.</p><form id="business-manager-login" data-slug={slug}><label>Email address<input id="business-login-email" type="email" required autoComplete="email"/></label><label>Password<input id="business-login-password" type="password" required autoComplete="current-password"/></label><button>Sign in</button><p id="login-status" role="status"></p></form></div></main><Script src="/manager-onboarding.js" strategy="afterInteractive"/></>}
