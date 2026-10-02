import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run=promisify(execFile),dist=fileURLToPath(new URL('../dist/',import.meta.url)),session=`passport-manual-${process.pid}`;
let state={configured:false,title:'오버월드 이용 안내',notionUrl:null,embedUrl:null,updatedAt:null}, failure=false;
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');const json=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 if(url.pathname==='/v1/manual')return json(failure?503:200,failure?{code:'temporarily_unavailable'}:state);
 if(url.pathname==='/v1/auth/session')return json(200,{authenticated:false,csrfToken:'fixture',authMode:'university'});
 if(url.pathname==='/v1/privacy')return json(200,{version:'fixture',purpose:'fixture',items:['fixture'],retention:'fixture',withdrawal:'fixture'});
 const requested=path.resolve(dist,`.${['/','/manual'].includes(url.pathname)?'/index.html':url.pathname}`);
 if(!requested.startsWith(dist))return json(404,{});
 try{const data=await readFile(requested);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(requested)]||'application/octet-stream','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://*.notion.site https://notion.site"});res.end(data);}catch{json(404,{});}
});
const browser=async(...args)=>(await run(process.env.PASSPORT_AGENT_BROWSER||'npx',[...(process.env.PASSPORT_AGENT_BROWSER?[]:['--yes','agent-browser@0.38.1']),'--session',session,...args],{timeout:30000,maxBuffer:1e6})).stdout.trim();
const inspect=async expression=>{let value=JSON.parse(await browser('eval',`JSON.stringify(${expression})`));if(typeof value==='string')value=JSON.parse(value);return value;};
const until=async expression=>{for(let n=0;n<20;n++){if(await inspect(expression))return;await new Promise(resolve=>setTimeout(resolve,250));}assert.fail(expression);};
const click=name=>browser('find','role','button','click','--name',name);
const open=async url=>{await browser('open','about:blank');await browser('open',url);await browser('wait','--load','networkidle');};
test('public manual supports missing settings, safe linked page and retry',{timeout:120000},async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 try {
  await open(origin+'/manual');await until('document.body.textContent.includes("등록된 매뉴얼이 없습니다")');assert.equal(await inspect('document.querySelector(".login-card")===null'),true);
  state={...state,configured:true,notionUrl:'https://example.notion.site/123456789012345678901234567890abce'};await open(origin+'/manual');await until('Boolean(document.querySelector(".manual-link-card"))');assert.equal(await inspect('document.querySelector(".manual-heading h2").textContent'),'오버월드 이용 안내');assert.equal(await inspect('document.querySelector(".manual-open").rel'),'noopener noreferrer');assert.equal(await inspect('document.querySelector("iframe")===null'),true);
  await browser('set','viewport','1440','900');await browser('screenshot','/tmp/passport-manual-desktop.png');await browser('set','viewport','390','844');assert.equal(await inspect('document.documentElement.scrollWidth<=innerWidth'),true);await browser('screenshot','/tmp/passport-manual-mobile.png','--full');
  failure=true;await open(origin+'/manual');await until('document.body.textContent.includes("매뉴얼을 불러오지 못했습니다")');failure=false;await click('다시 불러오기');await until('Boolean(document.querySelector(".manual-link-card"))');assert.equal(await browser('errors'),'');
 }finally{await browser('close').catch(()=>{});await new Promise(r=>server.close(r));}
});
