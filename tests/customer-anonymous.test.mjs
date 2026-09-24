import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

test('anonymous private feedback never stores a name or email and cannot request contact',async()=>{
  const compiled=await build({entryPoints:['app/api/customer/feedback/route.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'shared-fixture',setup(build){
    build.onResolve({filter:/\.\.\/\.\.\/_shared$/},()=>({path:'shared',namespace:'fixture'}));
    build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const CUSTOMER_FEEDBACK_LIMIT=25,CUSTOMER_FEEDBACK_WINDOW_SECONDS=3600;export const allow=async()=>true,anonymousKey=async()=>"key",sameOrigin=()=>true,json=(value,status=200)=>Response.json(value,{status}),db=()=>globalThis.__customerFeedbackDb;'}));
  }}]});
  const route=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
  const writes=[];
  globalThis.__customerFeedbackDb={prepare(sql){return {bind(...args){return {sql,args,async first(){return {id:'business-a'};}};}};},async batch(queries){writes.push(...queries);}};
  try{
    const payload={business:'business-a',message:'Please improve the waiting area',anonymous:true,name:'Someone',email:'person@example.test',contactRequested:false};
    const response=await route.POST(new Request('https://streetvouch.test/api/customer/feedback',{method:'POST',body:JSON.stringify(payload)}));
    assert.equal(response.status,200);
    const values=writes[0].args;
    assert.equal(values[2],null);
    assert.equal(values[3],null);
    assert.equal(values[5],0);
    const conflict=await route.POST(new Request('https://streetvouch.test/api/customer/feedback',{method:'POST',body:JSON.stringify({...payload,contactRequested:true})}));
    assert.equal(conflict.status,400);
    assert.equal(writes.length,2);
  }finally{delete globalThis.__customerFeedbackDb;}
});
