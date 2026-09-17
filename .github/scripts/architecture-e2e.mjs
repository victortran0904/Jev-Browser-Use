// No raw model outputs, credentials, profiles, screenshots or browser logs are saved.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm,appendFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import https from 'node:https';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {TypeSafeClient} from '@typesafe-ai/sdk';
import {createBrowserBoundary} from '../../server/browser.ts';
import {createRunController} from '../../server/runs.ts';
import {createPlanner} from '../../server/planner.ts';
import {createWriter} from '../../server/writer.ts';
import {traceStep,failureCategory} from '../../integration/trace.mjs';
import {fixtureResponse,journeys,exercise,flightPrompt} from '../../integration/journeys.mjs';

const mode=process.argv.includes('--public-flight')?'public-flight':process.argv.includes('--live')?'live':'deterministic';
const report={schemaVersion:1,mode,commit:process.env.GITHUB_SHA||'local',runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT||1),tests:[],requests:[]};
const counts={typesafe:0,gemini:0};
const classify=failureCategory;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  const provider=url.hostname==='api.typesafe.ai'?'typesafe':url.hostname==='generativelanguage.googleapis.com'?'gemini':null;
  if(!provider) {assert(['127.0.0.1','localhost'].includes(url.hostname),'Unexpected model request host');return originalFetch(input,init);}
  assert.equal(url.protocol,'https:');
  if(++counts[provider]>(provider==='typesafe'?140:80)) throw new Error('Request budget exceeded');
  const started=performance.now();
  const record={provider,number:counts[provider]}; report.requests.push(record);
  const prior=init?.signal||(input instanceof Request?input.signal:undefined);
  const signal=prior?AbortSignal.any([prior,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000);
  try {
    const response=await originalFetch(input,{...init,redirect:'error',signal});
    record.httpStatus=response.status; record.headersMs=Math.round(performance.now()-started);return response;
  } catch(error) {record.error=classify(error);throw error;}
};
const childEnv=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','HOME','DISPLAY','XAUTHORITY','TMPDIR','LANG','LD_LIBRARY_PATH'].includes(k)));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let temp,server,browserProcess,relayProcess;
const controllers=[];
let slowImageCompleted=false;
async function stopChild(child) {
  if(!child||child.exitCode!==null||child.signalCode!==null) return;
  const exited=once(child,'exit').catch(()=>{});child.kill('SIGTERM');
  await Promise.race([exited,pause(1500)]);
  if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited;}
}
async function save() {
  report.requestCounts=counts;
  await mkdir('.ci-results',{recursive:true});
  await writeFile(`.ci-results/architecture-${mode}.json`,JSON.stringify(report,null,2)+'\n');
  if(process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,`## Architecture E2E: ${mode}\n\n${mode==='public-flight'?'Public website attempt; no booking.':'All prices/content are controlled test fixtures, not real offers.'}\n\n| Case | Result | ms | Detail |\n|---|---|---:|---|\n${report.tests.map(t=>`| ${t.id} | ${t.status} | ${t.durationMs||0} | ${t.error||''} |`).join('\n')}\n`);
}
async function cleanup() {
  for(const [controller,run] of controllers) if(run.status==='running') controller.stop(run.id);
  await stopChild(browserProcess); await stopChild(relayProcess);
  server?.closeAllConnections();if(server?.listening) await new Promise(r=>server.close(r));
  if(temp) await rm(temp,{recursive:true,force:true});
}
const watchdog=setTimeout(async()=>{report.tests.push({id:'overall-deadline',status:'fail',error:'timeout'});await save();await cleanup();process.exit(1);},720000);
async function check(id,fn) {
  const start=performance.now();
  try {const details=await fn();report.tests.push({id,status:'pass',durationMs:Math.round(performance.now()-start),...details});console.log(`PASS ${id}`);}
  catch(error){report.tests.push({id,status:'fail',durationMs:Math.round(performance.now()-start),error:classify(error),...(Array.isArray(error.trace)?{trace:error.trace}:{}),...(error.stepCount!==undefined?{stepCount:error.stepCount}:{})});console.log(`FAIL ${id}: ${classify(error)}`);}
}
try {
  if(mode!=='deterministic'&&(!process.env.GEMINI_KEY||!process.env.TYPESAFE_API_KEY)) throw new Error('Missing repository secrets');
  temp=await mkdtemp(path.join(tmpdir(),'jev-architecture-'));
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(temp,'key.pem'),'-out',path.join(temp,'cert.pem'),'-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{env:childEnv,stdio:'ignore'});
  server=https.createServer({key:await readFile(path.join(temp,'key.pem')),cert:await readFile(path.join(temp,'cert.pem'))},async(req,res)=>{
    let body='';for await(const chunk of req){body+=chunk;if(body.length>10000){res.writeHead(413);res.end();return;}}
    const url=new URL(req.url,'https://127.0.0.1');const result=fixtureResponse(url,req.method,body);
    if(result.delay) await pause(result.delay);
    if(url.pathname==='/slow-image') slowImageCompleted=true;
    res.writeHead(result.status||200,{'content-type':'text/html','cache-control':'no-store',...result.headers});res.end(result.body);
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`https://127.0.0.1:${server.address().port}`;
  relayProcess=spawn(process.execPath,[path.resolve('node_modules/@opencode-ai/browser-control/dist/cli.js'),'serve'],{env:childEnv,stdio:'ignore'});
  const extension=path.resolve('node_modules/@opencode-ai/browser-control/extension/dist');
  browserProcess=spawn(chromium.executablePath(),[`--user-data-dir=${path.join(temp,'profile')}`,`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--no-default-browser-check','--no-sandbox','--disable-dev-shm-usage','--ignore-certificate-errors','--disable-background-networking','about:blank'],{env:childEnv,stdio:'ignore'});
  relayProcess.on('error',()=>{});browserProcess.on('error',()=>{});
  let ready=false;const deadline=performance.now()+45000;
  while(performance.now()<deadline){
    try {const response=await fetch('http://127.0.0.1:19989/extension/status',{signal:AbortSignal.timeout(1000)});const state=await response.json();if(state.connected&&state.protocolCompatible!==false){ready=true;break;}}catch{}
    await pause(250);
  }
  assert(ready,'Extension startup timeout');
  const boundary=createBrowserBoundary();
  const logger={debug(){},info(){},warn(){},error(){}};
  const makePlanner=()=>createPlanner(new TypeSafeClient({timeout:25000,retry:{maxRetries:1,backoffInitialMs:500,backoffMaxMs:1000,maxRetryAfterMs:2000},logger}));
  async function liveRun(scenario,publicFlight=false) {
    const safeBoundary=publicFlight?{...boundary,act:async(id,action,observation)=>{
      const target=observation.candidates.find(c=>c.ref===action.target);
      if(target&&/\b(book|purchase|reserve|checkout|pay|sign.in|log.in)\b/i.test(target.label)) throw new Error('Read-only flight test refused consequential action');
      return boundary.act(id,action,observation);
    }}:boundary;
    const trace=[];const realPlanner=makePlanner();
    const controller=createRunController({browser:safeBoundary,planner:{plan:async input=>{const action=await realPlanner.plan(input);trace.push(traceStep(action,input.observation,scenario.steps));return action;}},writer:createWriter(),enableScreenshots:false});
    const goal=publicFlight?`${flightPrompt}. Test assumptions: today is September 17, 2026; December means December 2026; currency CAD; one-way economy for one adult. Search public information only. Do not book, sign in, enter personal information, or bypass CAPTCHA. Stop only when a matching dated fare is visible.`:`Open ${scenario.url}. ${scenario.goal} Stop only when the requested result is visibly complete.`;
    const run=controller.start({goal});controllers.push([controller,run]);
    await controller.settled(run.id);
    if(run.status==='error') throw Object.assign(new Error(run.error||'Run failed'),{trace,stepCount:run.stepCount});
    const final=run.observation;
    if(publicFlight) {
      // A landing-page teaser or model declaration is not verified fare evidence.
      const line=(final?.pageContext||final?.snapshot||'').split('\n').find(l=>/Hanoi|\bHAN\b/i.test(l)&&/Vancouver|\bYVR\b/i.test(l)&&/Dec(?:ember)?\s+\d{1,2}.*2026|2026-12-\d{2}/i.test(l)&&/CAD|CA\$/i.test(l));
      const fare=line?.match(/(?:CAD\s*\$?|CA\$)\s*([\d,]+(?:\.\d{2})?)/i);
      const amount=fare?Number(fare[1].replace(/,/g,'')):NaN;
      assert(Number.isFinite(amount)&&amount>0&&amount<2500,'No verified dated flight under CAD 2500');
      return {verifiedFare:true,amountCAD:amount,sourceOrigin:new URL(final.url).origin,stepCount:run.stepCount};
    }
    if(!final?.snapshot.includes(scenario.proof)) throw Object.assign(new Error('Missing visible completion evidence'),{trace,stepCount:run.stepCount});
    assert.equal(run.status,'complete');
    return {stepCount:run.stepCount,timings:run.timings,trace};
  }
  if(mode==='public-flight') {
    report.originalPrompt=flightPrompt;report.assumptions={month:'2026-12',currency:'CAD',trip:'one-way',adults:1,cabin:'economy'};
    await check('public-flight-HAN-YVR-December',()=>liveRun({},true));
  } else {
    for(const scenario of journeys(base)) await check(scenario.id,async()=>{
      if(mode==='live') {
        if(!scenario.parallel) return liveRun(scenario);
        const other={...scenario,url:scenario.url.replace('side=left','side=right'),goal:'Finish the right session.',proof:'Journey complete: right session'};
        const both=await Promise.all([liveRun(scenario),liveRun(other)]);return {parallelSessions:2,steps:both.map(r=>r.stepCount)};
      }
      const id=`case-${scenario.id}`;
      try {
        if(scenario.parallel) {
          const other={...scenario,url:scenario.url.replace('side=left','side=right'),proof:'Journey complete: right session',steps:[['click','Finish right session']]};
          await Promise.all([exercise(boundary,id,scenario),exercise(boundary,id+'-other',other)]);
          return {parallelSessions:2};
        }
        const final=await exercise(boundary,id,scenario);
        if(scenario.id==='04-redirect') assert(!slowImageCompleted,'Navigation unnecessarily waited for a slow image');
        return {visibleEvidence:true,metrics:final.metrics};
      } finally {await boundary.close(id).catch(()=>{});if(scenario.parallel) await boundary.close(id+'-other').catch(()=>{});}
    });
  }
} catch(error) {report.tests.push({id:'setup-or-runtime',status:'fail',error:classify(error)});console.log(`FAIL setup-or-runtime: ${classify(error)}`);}
finally {clearTimeout(watchdog);await save();await cleanup();globalThis.fetch=originalFetch;}
process.exitCode=report.tests.some(t=>t.status!=='pass')?1:0;
