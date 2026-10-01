import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { privacy as basePrivacy } from './fixtures.mjs';
const privacy = {...basePrivacy,version:'2026-10-01.5'};
const run = promisify(execFile), dist=fileURLToPath(new URL('../dist/',import.meta.url)), session=`passport-stats-${process.pid}`;
const totals={playSeconds:7320,blocksBroken:5210,blocksPlaced:890,damageTakenMilli:125500,deaths:12,mobKills:302,playerKills:7,distanceCm:1250500};
const first={playSeconds:3660,blocksBroken:4100,blocksPlaced:450,damageTakenMilli:60500,deaths:8,mobKills:203,playerKills:2,distanceCm:54320};
let state;
const reset=()=>{state={authenticated:true,studentId:'20991234',accepted:true,available:true,online:true,statsError:false,consents:[],reads:[],hold:false,release:null,settings:{enabled:true,revision:"1",consentGranted:true},settingWrites:[],settingsError:null,excluded:false};};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');state.reads.push(url.pathname);
  const json=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const body=async()=>{let text='';for await(const part of req)text+=part;return JSON.parse(text);};
  if(url.pathname==='/v1/privacy')return json(200,privacy);
  if(url.pathname==='/v1/auth/session')return json(200,{authenticated:state.authenticated,authMode:'university',csrfToken:'synthetic-csrf',features:{discordLinking:true}});
  if(url.pathname==='/v1/me')return json(200,{id:'00000000-0000-4000-8000-000000000001',displayName:'합성 사용자',studentId:state.studentId,identityProvider:'usaint',department:'가상 학과',academicStatus:'ENROLLED',universityVerifiedAt:new Date().toISOString(),universityVerifiedUntil:'2027-02-28T15:00:00.000Z',accessSuspended:false,membership:{status:'active',effectiveStatus:'active',roleLabel:'가상 회원',verifiedUntil:new Date(Date.now()+86400000).toISOString()},minecraft:null,discordConnection:null,csrfToken:'synthetic-csrf',privacyConsent:{version:privacy.version,accepted:state.accepted}});
  if(url.pathname==='/v1/me/servers')return json(200,{servers:[]});
  if(url.pathname==='/v1/me/privacy/consent'){const input=await body();state.consents.push(input);assert.equal(req.headers['x-csrf-token'],'synthetic-csrf');state.accepted=true;return json(200,{updated:true});}
  if(url.pathname==='/v1/me/statistics-settings'){
    if(req.method==='PUT') { const input=await body();state.settingWrites.push({input,csrf:req.headers['x-csrf-token']});if(state.settingsError)return json(409,{code:state.settingsError});if(input.expectedRevision!==state.settings.revision)return json(409,{code:'statistics_settings_changed'});state.settings={...state.settings,enabled:input.enabled,revision:String(Number(state.settings.revision)+1)}; }
    return json(200,state.settings);
  }
  if(url.pathname==='/v1/me/stats'){
    if(url.pathname==='/v1/me/stats'&&!state.authenticated)return json(401,{code:'session_required'});
    if(state.statsError)return json(503,{code:'synthetic-sensitive-error'});
    const response={available:state.available,collection:{enabled:state.settings.enabled,consentGranted:state.settings.consentGranted,excludedServerIds:state.excluded?["first"]:[],historyRetained:true},totals:{...totals},servers:[{serverId:'first',label:'합성 건축 서버',collectionEnabled:!state.excluded,...first,onlinePlayerCount:state.online?1:0},{serverId:'second',label:'합성 야생 서버',collectionEnabled:true,...first,onlinePlayerCount:0}],presence:{online:state.online,serverId:state.online?'first':null,serverLabel:state.online?'합성 건축 서버':null,lastSeenAt:new Date().toISOString()},unexpectedPrivateField:'DO-NOT-RENDER-IDENTITY'};
    if(state.legacy) for(const counters of [response.totals,...response.servers]) { delete counters.playerKills; delete counters.distanceCm; }
    if(state.hold){state.hold=false;state.release=()=>json(200,response);return;}
    return json(200,response);
  }
  if(url.pathname==='/v1/auth/logout'){state.authenticated=false;return json(200,{});}
  const requested=path.resolve(dist,`.${['/','/me/stats'].includes(url.pathname)?'/index.html':url.pathname}`);
  if(!requested.startsWith(dist))return json(404,{});
  try{const data=await readFile(requested);const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(requested)]||'application/octet-stream';res.writeHead(200,{'Content-Type':mime,'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'"});res.end(data);}catch{json(404,{});}
});
const browser=async(...args)=>(await run(process.env.PASSPORT_AGENT_BROWSER||'npx',[...(process.env.PASSPORT_AGENT_BROWSER?[]:['--yes','agent-browser@0.38.1']),'--session',session,...args],{timeout:30000,maxBuffer:1e6})).stdout.trim();
const inspect=async expression=>{let value=JSON.parse(await browser('eval',`JSON.stringify(${expression})`));if(typeof value==='string')value=JSON.parse(value);return value;};
const until=async expression=>{for(let n=0;n<20;n++){if(await inspect(expression))return;await new Promise(resolve=>setTimeout(resolve,250));}assert.fail(expression);};
const click=name=>browser('find','role','button','click','--name',name);
const open=async url=>{await browser('open','about:blank');await browser('open',url);await browser('wait','--load','networkidle');};
test('private play statistics with explicit renewed consent',{timeout:240000},async t=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  await t.test('account home uses natural page scrolling with sticky sidebars and no nested scroll panes',async()=>{
   reset();await open(origin);await browser('set','viewport','1440','900');
   assert.equal(await inspect('document.querySelectorAll(".account-stat").length'),6);
   assert.equal(await inspect('document.querySelector(".account-stat strong").textContent'),'2시간 2분');
   assert.deepEqual(await inspect('[...document.querySelectorAll(".account-stat strong")].slice(-2).map(el=>el.textContent)'),['7','12.5 km']);
   assert.equal(await inspect('document.querySelector(".student-id").textContent'),'20991234');
   assert.equal(await inspect('document.querySelector(".verified-school-identity").textContent'),'20991234 합성 사용자');
   assert.equal(await inspect('[...document.querySelectorAll(".detail-list div")].find(item=>item.textContent.includes("학교 인증 유효기간")).querySelector("dd").textContent'),'2027년 2월 28일');
   assert.equal(await inspect('document.querySelector(".sidebar-profile button") === null'),true);
   assert.equal(await inspect('document.querySelector(".topbar .header-logout").textContent.trim()'),'로그아웃');
   assert.equal(await inspect('document.querySelector(".support-panel") === null'),true);
   assert.equal(await inspect('getComputedStyle(document.querySelector(".dashboard-main")).overflowY'),'visible');
   assert.equal(await inspect('getComputedStyle(document.querySelector(".dashboard-aside")).overflowY'),'visible');
   assert.equal(await inspect('document.querySelector(".dashboard-main").hasAttribute("tabindex") || document.querySelector(".dashboard-aside").hasAttribute("tabindex")'),false);
   assert.equal(await inspect('document.documentElement.scrollWidth <= innerWidth'),true);
   await browser('screenshot','/tmp/passport-natural-scroll-desktop-top.png');
   await browser('eval','window.scrollTo(0,350)');
   await until('window.scrollY >= 350');
   assert.equal(await inspect('document.querySelector(".app-sidebar").getBoundingClientRect().top'),0);
   assert.equal(await inspect('document.querySelector(".dashboard-aside").getBoundingClientRect().top'),24);
   const mainTop=await inspect('document.querySelector(".dashboard-main").getBoundingClientRect().top');
   await browser('eval','window.scrollTo(0,400)');
   await until('window.scrollY >= 400');
   assert.equal(await inspect('document.querySelector(".app-sidebar").getBoundingClientRect().top'),0);
   assert.equal(await inspect('document.querySelector(".dashboard-aside").getBoundingClientRect().top'),24);
   assert.ok(await inspect(`document.querySelector(".dashboard-main").getBoundingClientRect().top < ${mainTop}`));
   assert.equal(await inspect('document.querySelector(".dashboard-main").scrollTop + document.querySelector(".dashboard-aside").scrollTop'),0);
   assert.equal(await inspect('document.querySelector(".sidebar-brand").getBoundingClientRect().top'),26);
   await browser('eval','new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
   await browser('screenshot','/tmp/passport-natural-scroll-desktop-scrolled.png');
   await browser('eval','window.scrollTo(0,0)');
   await browser('set','viewport','390','844');
   assert.equal(await inspect('document.documentElement.scrollWidth <= innerWidth'),true);
   assert.equal(await inspect('getComputedStyle(document.querySelector(".dashboard-aside")).position'),'static');
   await browser('screenshot','/tmp/passport-natural-scroll-mobile.png');
   assert.equal(state.reads.includes('/v1/public/stats'),false);
  });
  await t.test('legacy profile never invents a student number and offers consent-gated school refresh',async()=>{
   reset();state.studentId=null;state.accepted=false;await open(origin);await browser('set','viewport','1440','900');
   assert.equal(await inspect('document.querySelector(".student-id").textContent'),'학번 확인 필요');
   assert.equal(await inspect('document.querySelector(".verified-school-identity").textContent'),'합성 사용자');
   assert.equal(await inspect('document.querySelector(".identity-reauth .primary").disabled'),true);
   assert.equal(await inspect('document.querySelector(".identity-reauth .primary").textContent'),'동의하고 학번 확인');
   assert.equal(await inspect('document.querySelector(".identity-reauth input").checked'),false);
   assert.equal(await inspect('document.querySelector(".privacy-renewal") === null'),true);
   await browser('set','viewport','1440','600');
   assert.equal(await inspect('getComputedStyle(document.querySelector(".dashboard-aside")).overflowY'),'visible');
   assert.equal(await inspect('document.querySelector(".dashboard-aside").scrollHeight <= document.querySelector(".dashboard-aside").clientHeight'),true);
   await browser('eval','window.scrollTo(0,document.documentElement.scrollHeight)');
   await until('window.scrollY > 0');
   assert.equal(await inspect('document.querySelector(".identity-reauth .primary").getBoundingClientRect().bottom <= innerHeight'),true);
   assert.equal(await inspect('document.querySelector(".dashboard-aside").scrollTop'),0);
   await browser('screenshot','/tmp/passport-natural-scroll-tall-sidebar.png');
  });
  await t.test('owner sees eight metrics and server filters after login',async()=>{
   reset();await open(origin+'/me/stats');await browser('set','viewport','1440','900');
   assert.equal(await inspect('document.querySelectorAll(".stats-metric").length'),8);assert.equal(await inspect('document.querySelector(".stats-presence").textContent.includes("접속 중합성 건축 서버")'),true);assert.equal(state.reads.includes('/v1/me'),true);
   assert.equal(await inspect('document.querySelector(".stats-metric strong").textContent'),'2시간 2분');assert.equal(await inspect('document.body.textContent.includes("DO-NOT-RENDER-IDENTITY")'),false);
   assert.equal(await inspect('document.documentElement.scrollWidth <= innerWidth'),true);
   assert.deepEqual(await inspect('[...document.querySelectorAll(".stats-metric")].slice(-2).map(el=>[el.querySelector("span").textContent,el.querySelector("strong").textContent])'),[['플레이어 처치','7'],['이동 거리','12.5 km']]);
   await browser('screenshot','/tmp/passport-natural-scroll-short-page.png');
   await browser('screenshot','/tmp/passport-user-stats-desktop.png');await browser('select','.stats-scope select','first');assert.equal(await inspect('document.querySelector(".stats-metric strong").textContent'),'1시간 1분');
   assert.deepEqual(await inspect('[...document.querySelectorAll(".stats-metric")].slice(-2).map(el=>el.querySelector("strong").textContent)'),['2','543 m']);
   await browser('set','viewport','390','844');assert.equal(await inspect('document.documentElement.scrollWidth <= innerWidth'),true);await browser('screenshot','/tmp/passport-user-stats-mobile.png','--full');
   state.legacy=true;await click('기록 새로고침');await until('document.querySelector(".stats-metric:last-child strong")?.textContent === "0 m"');assert.deepEqual(await inspect('[...document.querySelectorAll(".stats-metric")].slice(-2).map(el=>el.querySelector("strong").textContent)'),['0','0 m']);
  });
  await t.test('personal collection switch preserves history and enforces revision, CSRF and consent',async()=>{
   reset();await open(origin+'/me/stats');await until('document.querySelector("[role=switch]")?.disabled===false');
   const before=await inspect('[...document.querySelectorAll(".stats-metric strong")].map(el=>el.textContent)');await browser('click','[role=switch]');await until('document.querySelector("[role=switch]")?.getAttribute("aria-checked")==="false"');await until('document.querySelectorAll(".stats-metric").length===8');
   assert.deepEqual(state.settingWrites[0],{input:{enabled:false,expectedRevision:'1'},csrf:'synthetic-csrf'});assert.deepEqual(await inspect('[...document.querySelectorAll(".stats-metric strong")].map(el=>el.textContent)'),before);
   state.settingsError='statistics_settings_changed';await browser('click','[role=switch]');await until('document.body.textContent.includes("다른 곳에서 수집 설정이 변경되었습니다")');assert.equal(await inspect('document.querySelector("[role=switch]").disabled'),true);
   state.settingsError=null;state.settings={...state.settings,enabled:true,revision:'3'};await click('최신 설정 확인');await until('document.querySelector("[role=switch]")?.disabled===false');assert.equal(await inspect('document.querySelector("[role=switch]").getAttribute("aria-checked")'),'true');
   reset();state.settings={enabled:false,revision:'4',consentGranted:false};await open(origin+'/me/stats');await until('Boolean(document.querySelector("[role=switch]"))');assert.equal(await inspect('document.querySelector("[role=switch]").disabled'),true);assert.equal(state.settingWrites.length,0);
   assert.equal(await inspect('[...document.querySelectorAll("button")].some(button=>button.textContent.includes("초기화"))'),false);
  });
  await t.test('excluded server never shows zero metrics as collected history and user ON cannot override it',async()=>{
   reset();state.excluded=true;await open(origin+'/me/stats');await until('document.querySelectorAll(".stats-metric").length===8');assert.equal(await inspect('document.querySelector("[role=switch]").getAttribute("aria-checked")'),'true');
   assert.equal(await inspect('document.querySelector(".stats-scope-note").textContent.includes("전체 합계에서 제외")'),true);await browser('select','.stats-scope select','first');assert.equal(await inspect('document.querySelectorAll(".stats-metric").length'),0);assert.equal(await inspect('document.querySelector(".stats-disabled").textContent.includes("기존 기록은 보관")'),true);
   await browser('set','viewport','390','844');assert.equal(await inspect('document.documentElement.scrollWidth<=innerWidth'),true);await browser('screenshot','/tmp/passport-stats-disabled-mobile.png','--full');await browser('select','.stats-scope select','second');assert.equal(await inspect('document.querySelectorAll(".stats-metric").length'),8);assert.equal(state.settingWrites.length,0);
  });
  await t.test('personal deep link loads only owner endpoint and failed refresh removes old metrics',async()=>{
   reset();await open(origin+'/me/stats');assert.equal(state.reads.includes('/v1/me/stats'),true);assert.equal(state.reads.includes('/v1/public/stats'),false);
   await until('document.querySelectorAll(".stats-metric").length === 8');state.online=false;await click('기록 새로고침');await until('document.querySelector(".stats-presence strong")?.textContent === "오프라인"');state.statsError=true;await click('기록 새로고침');await until('document.querySelectorAll(".stats-metric").length === 0');
   assert.equal(await inspect('document.body.textContent.includes("synthetic-sensitive-error")'),false);state.statsError=false;state.available=false;await click('기록 새로고침');await until('document.body.textContent.includes("플레이 기록 집계를 준비하고 있어요")');
  });
  await t.test('renewed consent starts unchecked and submits actual current notice with CSRF',async()=>{
   reset();state.accepted=false;await open(origin);assert.equal(await inspect('document.querySelector(".privacy-renewal .primary").disabled'),true);
   assert.equal(await inspect('document.querySelector(".privacy-renewal input").checked'),false);assert.equal(state.consents.length,0);
   await browser('find','role','checkbox','check','--name','개인정보 수집·이용에 동의합니다.');await click('동의하고 게임 기능 사용');await until('document.querySelector(".privacy-renewal") === null');
   assert.deepEqual(state.consents,[{consent:{accepted:true,version:privacy.version}}]);assert.equal(await inspect('localStorage.length + sessionStorage.length'),0);
  });
  await t.test('logout during an old statistics request cannot restore personal metrics',async()=>{
   reset();await open(origin);state.hold=true;await click('내 플레이 기록');assert.equal(typeof state.release,'function');await click('로그아웃');await until('Boolean(document.querySelector(".login-card"))');state.release();state.release=null;await browser('wait','--load','networkidle');
   assert.equal(await inspect('document.querySelectorAll(".stats-metric").length'),0);assert.equal(await inspect('document.body.textContent.includes("합성 사용자")'),false);assert.equal(await browser('errors'),'');
  });
 }finally{state.release?.();await browser('close').catch(()=>{});await new Promise(resolve=>server.close(resolve));}
});
