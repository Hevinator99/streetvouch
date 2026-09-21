import { CustomerPageView, type CustomerBusiness } from "../../customer/customer-page";

export const dynamic="force-static";

const business:CustomerBusiness={
  id:"biz_vbc_01",
  slug:"village-barbers-cobham",
  name:"Village Barbers Cobham",
  logo_url:"/village-barbers-logo.jpeg",
  category:"Barbershop",
  customer_heading:"How was your visit?",
  customer_intro:"Share an honest review or send feedback privately.",
  customer_private_prompt:"Something we should know?",
  google_review_url:"https://www.google.com/search?q=Village+Barbers+Cobham#lrd=0x4875df983e87e645:0xff91360ffce80202,3,,,,",
  status:"active",
  page_approved:1,
};

export default function VillageBarbersTagPage(){return <CustomerPageView business={business} asset="bd4dc79e-850f-46fb-b6e6-6c131e90be57" entryChannel="nfc"/>;}
