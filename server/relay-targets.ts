/** Correlates relay-owned child sessions using CDP opener identity, never URLs. */
export interface RelayTarget { id: string; session: string; opener?: string }
export interface TargetSource { snapshot(): Promise<RelayTarget[]>; close(): void }
export function createRelayTargetSource(endpoint = process.env.BROWSER_CONTROL_ENDPOINT || 'http://127.0.0.1:19989'): TargetSource {
  let socket: WebSocket | undefined;
  let opening: Promise<void> | undefined;
  let nextId = 0;
  const requests = new Map<number, { resolve(value: any): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  const fail = () => { for (const request of requests.values()) { clearTimeout(request.timer); request.reject(new Error('Relay target connection lost')); } requests.clear(); socket=undefined; opening=undefined; };
  async function connect() {
    if (socket?.readyState === WebSocket.OPEN) return;
    if (opening) return opening;
    opening=(async()=>{
      const response=await fetch(`${endpoint}/json/version`,{signal:AbortSignal.timeout(2000)});
      if(!response.ok) throw new Error('Relay target discovery unavailable');
      const body=await response.json();
      const address=new URL(body.webSocketDebuggerUrl);
      const origin=new URL(endpoint);
      if(address.host!==origin.host || !['ws:','wss:'].includes(address.protocol)) throw new Error('Unexpected relay target endpoint');
      socket=new WebSocket(address);
      socket.addEventListener('message',event=>{
        let data;try{data=JSON.parse(String(event.data));}catch{return;}
        const request=requests.get(data.id); if(!request)return;
        requests.delete(data.id);clearTimeout(request.timer);
        if(data.error)request.reject(new Error('Relay target command rejected'));else request.resolve(data.result);
      });
      socket.addEventListener('close',fail);
      socket.addEventListener('error',fail);
      await new Promise<void>((resolve,reject)=>{
        const timer=setTimeout(()=>{socket?.close();reject(new Error('Relay target connection timeout'));},2000);
        socket!.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
        socket!.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Relay target connection error'));},{once:true});
      });
    })().finally(()=>{opening=undefined;});
    return opening;
  }
  async function send(method:string):Promise<any> {
    await connect();
    return new Promise((resolve,reject)=>{
      const id=++nextId;
      const timer=setTimeout(()=>{requests.delete(id);reject(new Error('Relay target request timeout'));},2000);
      requests.set(id,{resolve,reject,timer});
      try{socket!.send(JSON.stringify({id,method,params:{}}));}catch(error){clearTimeout(timer);requests.delete(id);reject(error);}
    });
  }
  return {
    async snapshot() {
      const [infos,response]=await Promise.all([send('Target.getTargets'),fetch(`${endpoint}/extension/status`,{signal:AbortSignal.timeout(2000)})]);
      if(!response.ok)throw new Error('Relay target status unavailable');
      const status=await response.json();
      const targets:Array<RelayTarget>=[];
      for(const target of status.targets??[]) {
        if(target.owner!=='relay'||!target.browserControlSessionId)continue;
        const info=(infos.targetInfos??[]).find((item:any)=>item.targetId===target.id);
        if(info?.type==='page') targets.push({id:target.id,session:target.browserControlSessionId,...(info.openerId?{opener:info.openerId}:{})});
      }
      return targets;
    },
    close(){socket?.close();fail();},
  };
}
