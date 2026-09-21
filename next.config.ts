import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers(){return[
    {source:"/t/:token",headers:[
      {key:"Cache-Control",value:"public, max-age=300, s-maxage=300, stale-while-revalidate=86400"},
      {key:"Cloudflare-CDN-Cache-Control",value:"public, s-maxage=300, stale-while-revalidate=86400"},
    ]},
    {source:"/customer/:path*",headers:[
      {key:"Cache-Control",value:"public, max-age=0, s-maxage=300, stale-while-revalidate=86400"},
      {key:"Cloudflare-CDN-Cache-Control",value:"public, s-maxage=300, stale-while-revalidate=86400"},
    ]},
    {source:"/customer-business.js",headers:[{key:"Cache-Control",value:"public, max-age=3600, stale-while-revalidate=86400"}]},
    {source:"/customer-business.css",headers:[{key:"Cache-Control",value:"public, max-age=3600, stale-while-revalidate=86400"}]},
    {source:"/:path*",headers:[
    {key:"Content-Security-Policy",value:"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://images.unsplash.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.resend.com https://oauth2.googleapis.com https://mybusiness.googleapis.com https://mybusinessaccountmanagement.googleapis.com https://mybusinessbusinessinformation.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"},
    {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
    {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
    {key:"X-Content-Type-Options",value:"nosniff"},
    {key:"X-Frame-Options",value:"DENY"},
    {key:"Strict-Transport-Security",value:"max-age=31536000; includeSubDomains"},
  ]}]},
};

export default nextConfig;
