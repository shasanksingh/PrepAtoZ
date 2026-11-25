import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { hashSecret } from '../server/crypto.mjs';

mkdirSync('.local',{recursive:true});
process.env.PREPATOZ_DB_FILE=resolve('.local/test-'+randomUUID()+'.sqlite');
process.env.PREPATOZ_ADMIN_EMAIL='owner@example.test';
const ADMIN_PASSWORD='Owner test password 542!';
process.env.PREPATOZ_ADMIN_PASSWORD_HASH=await hashSecret(ADMIN_PASSWORD);
delete process.env.NETLIFY;delete process.env.AWS_LAMBDA_FUNCTION_NAME;delete process.env.TURSO_DATABASE_URL;
const {handleApi}=await import('../server/api.mjs');
const {database}=await import('../server/db.mjs');
const protectedData=JSON.parse(readFileSync('server/private-data.json','utf8'));
const ORIGIN='https://prepatoz.example';
let sequence=0;
async function call(path,method='GET',body,cookie,origin=ORIGIN,ip='test-'+sequence++){
 const response=await handleApi(new Request(ORIGIN+'/api/'+path,{method,headers:{...(method!=='GET'?{'Content-Type':'application/json','Origin':origin}:{}),...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),{ip});
 const type=response.headers.get('content-type')||'';return{response,status:response.status,body:type.includes('application/json')?await response.json():Buffer.from(await response.arrayBuffer()),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const REGISTER={name:'Test Learner',email:'learner@example.test',password:'Learner password 900!',question:'memory',answer:'a private mountain phrase'};
let learner,admin;
test('registration ignores role escalation and stores salted hashes',async()=>{
 learner=await call('auth/register','POST',{...REGISTER,role:'admin'});assert.equal(learner.status,200);assert.equal(learner.body.user.role,'user');
 const db=await database(),[stored]=await db.query('SELECT * FROM users WHERE email=?',[REGISTER.email]);
 assert(stored.password_hash.startsWith('scrypt$'));assert(stored.recovery_hash.startsWith('scrypt$'));assert.notEqual(stored.password_hash,REGISTER.password);assert.notEqual(stored.recovery_hash,REGISTER.answer);
 const cookie=learner.response.headers.get('set-cookie');for(const part of ['HttpOnly','SameSite=Lax','Secure','Max-Age=604800'])assert(cookie.includes(part));
});
test('guests and regular accounts cannot retrieve project data or original PDFs',async()=>{
 assert.equal((await call('admin/content')).status,401);assert.equal((await call('admin/content','GET',undefined,learner.cookie)).status,403);
 const id=protectedData.topics[0].id;assert.equal((await call('admin/pdf/'+id)).status,401);assert.equal((await call('admin/pdf/'+id,'GET',undefined,learner.cookie)).status,403);
});
test('administrator email cannot be claimed through public registration',async()=>{
 assert.equal((await call('auth/register','POST',{...REGISTER,email:'owner@example.test'})).status,409);
});
test('cross-origin mutation and malformed requests are rejected',async()=>{
 assert.equal((await call('auth/register','POST',{...REGISTER,email:'cross@example.test'},undefined,'https://attacker.example')).status,403);
 assert.equal((await call('auth/register','POST',{...REGISTER,email:'short@example.test',password:'short'})).status,400);
});
test('account progress is isolated and concurrent stale writes are rejected',async()=>{
 const secretId=protectedData.protectedIds[0],progress={version:2,questions:{'mcp-roles':{learned:true,note:'Learner note'},[secretId]:{note:'must not sync for regular user'}},last:secretId,quizzes:{ml:85,aws:75,mixed:90,mcp:100,invalid:Infinity},activity:{days:['2026-01-01','2026-01-01','2026-02-30'],daily:['2026-01-01','2025-12-31']}};
 const first=await call('progress','PUT',{progress,revision:0},learner.cookie);assert.equal(first.status,200);assert.equal(first.body.revision,1);
 const read=await call('progress','GET',undefined,learner.cookie);assert.equal(read.body.progress.questions['mcp-roles'].note,'Learner note');assert(!read.body.progress.questions[secretId]);assert.equal(read.body.progress.last,null);
 assert.deepEqual(read.body.progress.quizzes,{ml:85,aws:75,mixed:90,mcp:100});assert.deepEqual(read.body.progress.activity,{days:['2026-01-01'],daily:['2026-01-01']});
 const second=await call('auth/register','POST',{...REGISTER,email:'other@example.test'});assert.equal((await call('progress','GET',undefined,second.cookie)).body.progress,null);
 assert.equal((await call('progress','PUT',{progress,revision:0},learner.cookie)).status,409);
 assert.equal((await call('progress','PUT',{progress,revision:1},learner.cookie)).body.revision,2);
});
test('admin login returns project data and protects PDF path lookup',async()=>{
 admin=await call('auth/login','POST',{email:'owner@example.test',password:ADMIN_PASSWORD});assert.equal(admin.status,200);assert.equal(admin.body.user.role,'admin');
 const result=await call('admin/content','GET',undefined,admin.cookie);assert.equal(result.status,200);assert(result.body.topics.some(t=>t.questions.some(q=>q.adminOnly)));
 const pdf=await call('admin/pdf/'+protectedData.topics[0].id,'GET',undefined,admin.cookie);assert.equal(pdf.status,200);assert.equal(pdf.body.subarray(0,4).toString(),'%PDF');assert(pdf.response.headers.get('cache-control').includes('no-store'));
 assert.equal((await call('admin/pdf/%2e%2e%2fpackage.json','GET',undefined,admin.cookie)).status,404);
});
test('security-answer reset invalidates sessions and cannot reset an admin',async()=>{
 assert.equal((await call('auth/reset','POST',{...REGISTER,answer:'wrong recovery answer',password:'New learner password 143!'})).status,400);
 assert.equal((await call('auth/reset','POST',{...REGISTER,email:'owner@example.test',password:'Trying new password 143!'})).status,400);
 const reset=await call('auth/reset','POST',{...REGISTER,answer:'  A PRIVATE MOUNTAIN PHRASE  ',password:'New learner password 143!'});assert.equal(reset.status,200);
 assert.equal((await call('session','GET',undefined,learner.cookie)).body.user,null);
 assert.equal((await call('auth/login','POST',{email:REGISTER.email,password:REGISTER.password})).status,401);
 assert.equal((await call('auth/login','POST',{email:REGISTER.email,password:'New learner password 143!'})).status,200);
});
test('expired and signed-out sessions cannot access protected content',async()=>{
 await call('auth/logout','POST',{},admin.cookie);assert.equal((await call('admin/content','GET',undefined,admin.cookie)).status,401);
 const fresh=await call('auth/login','POST',{email:'owner@example.test',password:ADMIN_PASSWORD});
 const db=await database();await db.query('UPDATE sessions SET expires_ms=0 WHERE user_id=?',['owner-admin']);assert.equal((await call('admin/content','GET',undefined,fresh.cookie)).status,401);
});
test('recovery attempts are durably rate limited by account',async()=>{
 for(let i=0;i<5;i++)assert.equal((await call('auth/reset','POST',{...REGISTER,email:'missing@example.test',password:'Another valid password!'},undefined,ORIGIN,'reset-test')).status,400);
 assert.equal((await call('auth/reset','POST',{...REGISTER,email:'missing@example.test',password:'Another valid password!'},undefined,ORIGIN,'reset-test')).status,429);
});
test('production does not silently fall back to an ephemeral local SQLite file',()=>{
 const child=spawnSync(process.execPath,['--input-type=module','-e',"import {configured} from './server/db.mjs'; if(configured())process.exit(1);"],{cwd:process.cwd(),env:{...process.env,NETLIFY:'true',TURSO_DATABASE_URL:''},encoding:'utf8'});assert.equal(child.status,0,child.stderr);
});
