import test from 'node:test';
import assert from 'node:assert/strict';
import {createRelayTargetSource} from '../server/relay-targets.ts';

test('target provenance respects the owning session scope',async()=>{
  const originalFetch=globalThis.fetch,OriginalWebSocket=globalThis.WebSocket;
  const targets=[{id:'root',owner:'relay',browserControlSessionId:'root-session'},{id:'child',owner:'relay',browserControlSessionId:'child-session'}];
  globalThis.fetch=async url=>Response.json(String(url).endsWith('/json/version')?{webSocketDebuggerUrl:'ws://127.0.0.1:19989/devtools/browser/local'}:{targets});
  globalThis.WebSocket=class extends EventTarget {
    static OPEN=1;readyState=0;
    constructor(url){super();this.url=new URL(url);queueMicrotask(()=>{this.readyState=1;this.dispatchEvent(new Event('open'));});}
    send(raw){
      const command=JSON.parse(raw);
      const target=targets.find(t=>t.browserControlSessionId===this.url.searchParams.get('browserControlSessionId'));
      const info=target?{targetId:target.id,type:'page',...(target.id==='child'?{openerId:'root'}:{})}:undefined;
      queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:command.id,result:command.method==='Target.getTargets'?{targetInfos:info?[info]:[]}:{targetInfo:info}})})));
    }
    close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
  };
  const source=createRelayTargetSource();
  try {const result=await source.snapshot();assert.equal(result.find(t=>t.id==='child')?.opener,'root');}
  finally {source.close();globalThis.fetch=originalFetch;globalThis.WebSocket=OriginalWebSocket;}
});
