import Script from "next/script";

export default function SiteShell() {
  return <><link rel="stylesheet" href="/style.css" /><div id="app" /><Script src="/app.js" strategy="afterInteractive" /><Script src="/pilot.js" strategy="afterInteractive" /><Script src="/marketing-demo.js" strategy="afterInteractive" /></>;
}
