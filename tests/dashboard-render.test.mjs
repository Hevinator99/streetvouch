import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
test('shared dashboard renders real counts, deduplicates priorities and does not invent Google coverage',async()=>{
 const result=await build({entryPoints:['app/manager/dashboard.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'mock-worker',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const env = globalThis.__dashboardFixture;'}));b.onResolve({filter:/^next\/script$/},()=>({path:'script',namespace:'fixture-script'}));b.onLoad({filter:/.*/,namespace:'fixture-script'},()=>({contents:'export default function Script(){return null;}'}));}}]});
 const today=new Date().toISOString(),old=new Date(Date.now()-60*86400000).toISOString();
 const feedback=[{id:'f1',message:'Terrible cut',customer_name:null,customer_email:null,created_at:today,status:'new',severity:'attention',contact_requested:1,contacted_at:null,internal_note:null,due_at:null},{id:'f2',message:'Good haircut',customer_name:null,created_at:today,status:'new',severity:'normal',contact_requested:0}];
 globalThis.__dashboardFixture={DB:{prepare(sql){return {bind(...args){
   assert.ok(args.includes('fixture-business'),'all queries must be tenant scoped');
   return {async all(){return {results:sql.includes('FROM feedback')?feedback:[]};},async first(){return sql.includes('FROM businesses')?{address:null,created_at:old}:null;}};
 }};}}};
 const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);
 const element=await module.exports.default({session:{businessId:'fixture-business',businessSlug:'fixture',businessName:'Fixture Business'},query:{}});
 const {renderToStaticMarkup}=require('react-dom/server');const html=renderToStaticMarkup(element);
 assert.match(html,/1 item needs your attention/);assert.doesNotMatch(html,/2 items need your attention/);
 assert.match(html,/Google not connected/);assert.match(html,/Good haircut/);assert.match(html,/Terrible cut/);
 assert.match(html,/data-theme-link/);assert.match(html,/sv-donut/);assert.match(html,/sv-bar private/);
 assert.doesNotMatch(html,/Village Barbers/);
 delete globalThis.__dashboardFixture;
});
