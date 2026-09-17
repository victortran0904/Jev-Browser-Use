// Read-only diagnostics for the fresh controlled browser in deterministic CI.
// Identifiers are replaced with numeric aliases; URLs, titles and bodies omitted.
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
    return response;
  };
  const OriginalWebSocket=globalThis.WebSocket;
  globalThis.WebSocket=class extends OriginalWebSocket {
    constructor(url,protocols){
      super(url,protocols);
      const address=new URL(url);
      const session=alias(address.searchParams.get('browserControlSessionId'));
      this.addEventListener('message',event=>{
        let data;try{data=JSON.parse(String(event.data));}catch{return;}
        const info=data.result?.targetInfo;
        if(info) console.log('TARGET_INFO '+JSON.stringify({session,target:alias(info.targetId),opener:alias(info.openerId),canAccessOpener:info.canAccessOpener===true,type:info.type==='page'?'page':'other'}));
      });
    }
  };
}
