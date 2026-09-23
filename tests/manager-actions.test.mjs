import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);

test('manager feedback actions check tenant ownership and issue the intended updates',async()=>{
  const result=await build({entryPoints:['app/api/manager/status/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'fixture',setup(b){
    b.onResolve({filter:/manager-auth$/},()=>({path:'auth',namespace:'fixture'}));
    b.onLoad({filter:/^auth$/,namespace:'fixture'},()=>({contents:'export const getManagerSession=async()=>globalThis.__actionSession;'}));
    b.onResolve({filter:/_shared$/},()=>({path:'shared',namespace:'fixture'}));
    b.onLoad({filter:/^shared$/,namespace:'fixture'},()=>({contents:'export const db=()=>globalThis.__actionDb;export const sameOrigin=()=>true;export const json=(value,status=200)=>Response.json(value,{status});'}));
  }}]});
  const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);
  const calls=[];let owned=false;
  globalThis.__actionSession={businessId:'business-a',email:'manager@example.test'};
  globalThis.__actionDb={prepare(sql){return {bind(...args){const query={sql,args};return {...query,async first(){return owned?{id:'f1'}:null;},async run(){calls.push(query);}};}};},async batch(queries){calls.push(...queries);}};
  const post=async body=>module.exports.POST(new Request('https://streetvouch.example/api/manager/status',{method:'POST',body:JSON.stringify(body)}));
  let response=await post({id:'f1',action:'note',note:'Follow up'});
  assert.equal(response.status,404);assert.equal(calls.length,0,'no cross-business writes or audit events');
  owned=true;
  response=await post({id:'f1',action:'note',note:'Follow up'});
  assert.equal(response.status,200);assert.ok(calls.some(x=>x.sql.includes('UPDATE feedback SET internal_note=')&&x.args.includes('Follow up')));
  calls.length=0;
  response=await post({id:'f1',status:'reviewed'});
  assert.equal(response.status,200);assert.ok(calls.some(x=>x.sql.includes('UPDATE feedback SET status=')&&x.args.includes('reviewed')));
  calls.length=0;
  response=await post({id:'f1',action:'contacted'});
  assert.equal(response.status,200);assert.ok(calls.some(x=>x.sql.includes("status='resolved'")));
  calls.length=0;
  response=await post({id:'f1',status:'archived'});
  assert.equal(response.status,200);assert.ok(calls.some(x=>x.sql.includes('UPDATE feedback SET status=')&&x.args.includes('archived')));
  delete globalThis.__actionSession;delete globalThis.__actionDb;
});
