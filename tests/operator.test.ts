import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { canReply,attentionCount,emailOutcome } from '../lib/operator';

test('contact permission, workload deduplication and uncertain delivery are explicit',()=>{
 assert.equal(canReply({customer_email:'customer@example.com',contact_requested:0}),false);
 assert.equal(canReply({customer_email:'customer@example.com',contact_requested:1}),true);
 assert.equal(canReply({customer_email:'invalid',contact_requested:1}),false);
 assert.equal(attentionCount([{id:'one',status:'new',severity:'serious',contact_requested:1,contacted_at:null}]),1);
 assert.equal(emailOutcome(200),'sent');assert.equal(emailOutcome(422),'failed');assert.equal(emailOutcome(503),'unknown');assert.equal(emailOutcome(408),'unknown');
});

test('operator routes enforce isolation, persist drafts/history, block duplicate sends and gate activation',async()=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(`drizzle/${f}`,'utf8'));
 const database={prepare(sql:string){let values:any[]=[];const stmt={bind(...v:any[]){values=v;return stmt;},async first(){return sqlite.prepare(sql).get(...values)??null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){const r=sqlite.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}};}};return stmt;},async batch(statements:any[]){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 const state={env:{DB:database,OWNER_EMAIL:'operator@example.com',RESEND_API_KEY:'test-key',EMAIL_FROM:'test@example.com'},headers:new Headers({'oai-authenticated-user-email':'operator@example.com'}),googleCalls:0};
 (globalThis as any).__operatorTest=state;
 const routes:any={};
 for(const name of ['workspace','onboarding','reports','businesses']){
 const result=await build({entryPoints:[`app/api/admin/${name}/route.ts`],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'test-bindings',setup(b){b.onResolve({filter:/^(cloudflare:workers|next\/headers)$/},a=>({path:a.path,namespace:'test'}));b.onResolve({filter:/\/google$/},a=>({path:a.path,namespace:'google'}));b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path==='cloudflare:workers'?'export const env=globalThis.__operatorTest.env;':'export async function headers(){return globalThis.__operatorTest.headers;}',loader:'js'}));b.onLoad({filter:/.*/,namespace:'google'},()=>({contents:'export async function publishGoogleReply(){globalThis.__operatorTest.googleCalls++;} export async function syncGoogleReviews(){return 0;}',loader:'js'}));}}]});routes[name]=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
 }
 const now=new Date().toISOString();
 for(const id of ['a','b']){
 sqlite.prepare("INSERT INTO businesses (id,slug,name,google_review_url,contact_email,status,created_at) VALUES (?,?,?,?,?,'setup',?)").run(id,id,`Business ${id}`,'https://example.com',`${id}@example.com`,now);
 sqlite.prepare('INSERT INTO onboarding_checks (business_id,updated_at) VALUES (?,?)').run(id,now);
 sqlite.prepare("INSERT INTO feedback (id,business_id,message,customer_email,contact_requested,status,severity,created_at) VALUES (?,?,?,?,1,'new','serious',?)").run(`f-${id}`,id,`Private ${id}`,'customer@example.com',now);
 }
 const get=(query:string)=>routes.workspace.GET(new Request(`https://test.local/api/admin/workspace?${query}`));
 const post=(body:any,name='workspace')=>routes[name].POST(new Request('https://test.local/api/admin/workspace',{method:'POST',headers:{origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify(body)}));
 state.headers=new Headers();assert.equal((await get('view=inbox')).status,403);
 state.headers=new Headers({'oai-authenticated-user-email':'client@example.com'});assert.equal((await get('view=inbox')).status,403);assert.equal((await post({action:'case',businessId:'a',id:'f-a'})).status,403);
 state.headers=new Headers({'oai-authenticated-user-email':'operator@example.com'});
 for(const view of ['overview','attention','businesses','health','inbox','reviews','reports','profile','choices']){const r=await get(`view=${view}&business=a`);assert.equal(r.status,200,`${view}: ${await r.clone().text()}`);}
 assert.equal((await get('view=businesses&sort=invalid')).status,200);
 const update=await routes.businesses.PATCH(new Request('https://test.local/api/admin/businesses',{method:'PATCH',headers:{origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify({businessId:'a',name:'Business a',contactEmail:'a@example.com',category:'Local shop',phone:'0123456789',address:'Test address',googleProfileUrl:'https://example.com',customerHeading:'How was your visit?',customerIntro:'Feedback welcome',customerPrivatePrompt:'Tell us more',publishCustomerPage:true})}));assert.equal(update.status,200);assert.equal((await update.json()).published,true);assert.equal(sqlite.prepare("SELECT page_approved FROM businesses WHERE id='a'").get()?.page_approved,1);assert.equal(sqlite.prepare("SELECT customer_page_approved FROM onboarding_checks WHERE business_id='a'").get()?.customer_page_approved,1);
 const inbox=await (await get('view=inbox&business=a')).json();assert.equal(inbox.rows.length,1);assert.equal(inbox.rows[0].id,'f-a');
 assert.equal((await post({action:'draft',id:'f-a',businessId:'b',text:'Wrong business'})).status,404);
 const drafted=await (await post({action:'draft',id:'f-a',businessId:'a',text:'Thank you. We will ask the owner to review this.'})).json();assert.ok(drafted.messageId);
 await post({action:'note',id:'f-a',businessId:'a',text:'Operator-only note'});
 await post({action:'case',id:'f-a',businessId:'a',status:'escalated',assignee:'Business owner',dueAt:'2026-10-01'});
 let calls=0;const realFetch=globalThis.fetch;
 globalThis.fetch=async()=>{calls++;return Response.json({id:'email-1'});};
 try{
 const sending={action:'send',id:'f-a',businessId:'a',messageId:drafted.messageId,confirmed:true};
 assert.equal((await post(sending)).status,200);assert.equal((await post(sending)).status,409);assert.equal(calls,1);
 const history=await (await get('case=f-a')).json();assert.equal(history.messages.filter((m:any)=>m.kind==='note').length,1);assert.equal(history.messages.find((m:any)=>m.id===drafted.messageId).status,'sent');assert.ok(history.audit.length>=4);
 assert.equal((await post({businessId:'a',action:'activate'},'onboarding')).status,409);
 assert.equal((await post({businessId:'a',action:'check',check:'google_connection_tested',value:true},'onboarding')).status,409);
 sqlite.prepare("INSERT INTO google_reviews(id,business_id,google_review_id,rating,google_created_at,google_updated_at,synced_at) VALUES ('r-a','a','google-a',2,?,?,?)").run(now,now,now);
 assert.equal((await post({action:'review_publish',businessId:'a',id:'r-a',text:'Thanks',confirmed:true})).status,409);assert.equal(state.googleCalls,0);
 sqlite.prepare("INSERT INTO google_connections(id,business_id,status,last_synced_at,created_at,updated_at) VALUES ('gc-a','a','connected',?,?,?)").run(now,now,now);
 assert.equal((await post({action:'review_publish',businessId:'b',id:'r-a',text:'Thanks',confirmed:true})).status,404);
 assert.equal((await post({action:'review_publish',businessId:'a',id:'r-a',text:'Thanks',confirmed:true})).status,200);assert.equal(state.googleCalls,1);
 sqlite.prepare("INSERT INTO manager_users(id,business_id,email,role,active,created_at) VALUES ('ma','a','a@example.com','owner',1,?)").run(now);
 sqlite.prepare("INSERT INTO business_assets(id,business_id,token,label,placement,asset_type,active,created_at,updated_at) VALUES ('aa','a','test-token','Local test','Counter','counter',1,?,?)").run(now,now);
 sqlite.exec("UPDATE businesses SET page_approved=1 WHERE id='a'; UPDATE onboarding_checks SET business_details_complete=1,manager_account_active=1,google_connection_tested=1,customer_page_approved=1,nfc_tested=1,qr_tested=1,private_feedback_tested=1,notification_email_tested=1 WHERE business_id='a'");
 assert.equal((await post({businessId:'a',action:'activate'},'onboarding')).status,200);
 assert.equal((await post({businessId:'a',action:'pause'},'onboarding')).status,200);
 assert.equal(sqlite.prepare("SELECT active FROM businesses WHERE id='a'").get()?.active,0);
 assert.equal((await post({action:'review_draft',businessId:'a',id:'r-a',text:'Draft'})).status,200);
 const noPermission=await (await post({action:'draft',id:'f-b',businessId:'b',text:'Reply'})).json();sqlite.prepare('UPDATE feedback SET contact_requested=0 WHERE id=?').run('f-b');assert.equal((await post({action:'send',id:'f-b',businessId:'b',messageId:noPermission.messageId,confirmed:true})).status,400);
 globalThis.fetch=async()=>new Response('',{status:422});const failed=await (await post({action:'draft',id:'f-a',businessId:'a',text:'Failed message test'})).json();assert.equal((await post({...sending,messageId:failed.messageId})).status,502);assert.equal(sqlite.prepare('SELECT status FROM operator_messages WHERE id=?').get(failed.messageId)?.status,'failed');
 globalThis.fetch=async()=>new Response('',{status:503});const uncertain=await (await post({action:'draft',id:'f-a',businessId:'a',text:'Another message'})).json();assert.equal((await post({...sending,messageId:uncertain.messageId})).status,502);assert.equal(sqlite.prepare('SELECT status FROM operator_messages WHERE id=?').get(uncertain.messageId)?.status,'unknown');assert.equal((await post({...sending,messageId:uncertain.messageId})).status,409);
 globalThis.fetch=async()=>Response.json({id:'report-1'});assert.equal((await post({businessId:'b'},'reports')).status,200);assert.equal((await post({businessId:'b'},'reports')).status,200);assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM report_deliveries WHERE business_id='b'").get()?.count,2);
 }finally{globalThis.fetch=realFetch;sqlite.close();delete (globalThis as any).__operatorTest;}
});
