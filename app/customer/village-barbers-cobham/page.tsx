import { CustomerPageView, type CustomerBusiness } from "../customer-page";

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

export default function VillageBarbersCustomerPage(){return <CustomerPageView business={business}/>;}
