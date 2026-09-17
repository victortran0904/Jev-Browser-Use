import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

// Only external relay/CLI boundaries are simulated; exercise application code.
test('a lost mutation response is outcome-unknown and is not replayed',async()=>{
  const cwd=process.cwd(),originalFetch=globalThis.fetch;
  const dir=await mkdtemp(path.join(tmpdir(),'jev-transport-'));
  const marker=path.join(dir,'effects.txt');
  await writeFile(marker,'');
  await mkdir(path.join(dir,'node_modules/.bin'),{recursive:true});
  await writeFile(path.join(dir,'node_modules/.bin/browser-control'),`#!${process.execPath}\nrequire('node:fs').appendFileSync(${JSON.stringify(marker)},'CLI\\n');console.log(JSON.stringify({ok:true,value:'typed'}));\n`,{mode:0o755});
  process.chdir(dir);
  try {
    const {createBrowserBoundary}=await import('../server/browser.ts');
    globalThis.fetch=async url=>{
      if(String(url).endsWith('/cli/session/new')) return Response.json({session:{id:'jev-transport'}});
      await writeFile(marker,(await readFile(marker,'utf8'))+'HTTP\n');
      throw Object.assign(new Error('Connection lost after dispatch'),{cause:{code:'ECONNRESET'}});
    };
    const boundary=createBrowserBoundary();
    const o={id:'o',url:'https://example.com',title:'',snapshot:'',candidates:[],focusedField:{label:'Search',placeholder:'',value:'',isText:true}};
    await assert.rejects(boundary.act('transport',{kind:'type_text',value:'search',observationId:'o'},o),/outcome.unknown/i);
    assert.equal(await readFile(marker,'utf8'),'HTTP\n');
  } finally {globalThis.fetch=originalFetch;process.chdir(cwd);await rm(dir,{recursive:true,force:true});}
});
test('HTTP rejection is surfaced without a second execution',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:'rejected'},{status:403});
  try {const {defaultCommandRunner}=await import('../server/browser.ts');const result=JSON.parse(await defaultCommandRunner(['execute','--json','--session','s','return true']));assert.equal(result.ok,false);assert.match(result.error,/403/);}
  finally {globalThis.fetch=original;}
});
test('negative execution envelopes stay unsuccessful',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({ok:false,value:'not completed'});
  try {const {defaultCommandRunner}=await import('../server/browser.ts');assert.equal(JSON.parse(await defaultCommandRunner(['execute','--json','--session','s','return true'])).ok,false);}
  finally {globalThis.fetch=original;}
});
test('a lost session-creation response is not replayed',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>{throw Object.assign(new Error('Lost response'),{cause:{code:'ECONNRESET'}});};
  try {const {defaultCommandRunner}=await import('../server/browser.ts');await assert.rejects(defaultCommandRunner(['session','new','test']),/outcome.unknown/i);}
  finally {globalThis.fetch=original;}
});
test('unrecognized relay responses cannot report success',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({unexpected:'payload'});
  try {const {defaultCommandRunner}=await import('../server/browser.ts');await assert.rejects(defaultCommandRunner(['execute','--json','--session','s','return true']),/outcome.unknown|invalid|malformed/i);}
  finally {globalThis.fetch=original;}
});
