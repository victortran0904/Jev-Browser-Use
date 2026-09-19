// Read-only diagnostics in the disposable deterministic fixture browser only.
// IDs are numeric aliases; no URLs, titles, page bodies or provider data logged.
if (process.argv.includes('--deterministic')) {
  const aliases=new Map();
  const alias=value=>value?(aliases.has(value)?aliases.get(value):(aliases.set(value,aliases.size+1),aliases.get(value))):null;
  const originalFetch=globalThis.fetch;
  let last='';
  globalThis.fetch=async(input,init)=>{
    const response=await originalFetch(input,init);
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
    if(url.hostname==='127.0.0.1'&&url.pathname==='/json/list'&&response.ok){
      const list=await response.clone().json();
      const safe=Array.isArray(list)?list.map(t=>({target:alias(t.id),session:alias(t.browserControlSessionId),owner:['relay','user'].includes(t.owner)?t.owner:'other',type:t.type==='page'?'page':'other'})):[];
      const encoded=JSON.stringify(safe);
      if(encoded!==last){last=encoded;console.log('TARGET_LIST '+encoded);}
    }
    if(url.hostname==='127.0.0.1'&&url.pathname==='/cli/execute'&&typeof init?.body==='string'&&response.ok){
      const request=JSON.parse(init.body);
      if(request.code?.includes('target.click(')) {
        await new Promise(resolve=>setTimeout(resolve,400));
        const probe=await originalFetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:request.sessionId,createIfMissing:false,code:'return {pageCount: context.pages().length, tracked: state.__jevPages?.size || 0, hasNext: !!state.__jevNext, pages: await Promise.all(context.pages().map(async child => ({original: child===page, closed: child.isClosed(), parentIsOriginal: (await child.opener())===page})))};'}),signal:AbortSignal.timeout(3000)}).catch(()=>null);
        const result=probe?.ok?await probe.json():null;
        const info=result?.value;
        console.log('PAGE_CONTEXT '+JSON.stringify({session:alias(request.sessionId),available:!!info,...(info?{pageCount:info.pageCount,tracked:info.tracked,hasNext:info.hasNext,pages:info.pages}: {})}));
      }
    }
    return response;
  };
  const OriginalWebSocket=globalThis.WebSocket;
  globalThis.WebSocket=class extends OriginalWebSocket {
    constructor(url,protocols){
      super(url,protocols);
      const session=alias(new URL(url).searchParams.get('browserControlSessionId'));
      this.addEventListener('message',event=>{
        let data;try{data=JSON.parse(String(event.data));}catch{return;}
        const info=data.result?.targetInfo;
        if(info) console.log('TARGET_INFO '+JSON.stringify({session,target:alias(info.targetId),opener:alias(info.openerId),canAccessOpener:info.canAccessOpener===true,type:info.type==='page'?'page':'other'}));
      });
    }
  };
}
