import { db } from "../_shared";

export async function GET(){
  try{
    const row=await db().prepare("SELECT 1 ok").first<{ok:number}>();
    if(row?.ok!==1)throw new Error("Database check failed");
    return Response.json({ok:true},{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }catch(error){
    console.error("health_check_failed",error);
    return Response.json({ok:false},{status:503,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }
}
