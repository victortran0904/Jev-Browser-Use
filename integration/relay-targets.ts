/** Read-only metadata; session isolation is respected on every CDP request. */
export interface RelayTarget { id: string; session: string; opener?: string }
export interface TargetSource { snapshot(): Promise<RelayTarget[]>; close(): void }
interface StatusTarget { id: string; owner?: string; browserControlSessionId?: string }
interface TargetInfo { targetId: string; type: string; openerId?: string }
export function createRelayTargetSource(endpoint = process.env.BROWSER_CONTROL_ENDPOINT || 'http://127.0.0.1:19989'): TargetSource {
  const cache = new Map<string, RelayTarget>();
  const pending = new Map<string, Promise<RelayTarget | undefined>>();
  const sockets = new Set<WebSocket>();
  let generation = 0;
  async function inspect(target: StatusTarget): Promise<RelayTarget | undefined> {
    const session = target.browserControlSessionId!;
    const response = await fetch(`${endpoint}/json/version`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw new Error('Relay target discovery unavailable');
    const body = await response.json();
    const address = new URL(body.webSocketDebuggerUrl);
    if (address.host !== new URL(endpoint).host || !['ws:', 'wss:'].includes(address.protocol)) throw new Error('Unexpected relay target endpoint');
    address.searchParams.set('browserControlSessionId', session);
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(address);
      sockets.add(socket);
      let settled = false;
      const timer = setTimeout(() => finish(new Error('Relay target request timeout')), 2500);
      function finish(error?: Error, value?: RelayTarget) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        sockets.delete(socket);
        socket.close();
        if (error) reject(error); else resolve(value);
      }
      socket.addEventListener('open', () => socket.send(JSON.stringify({ id: 1, method: 'Target.getTargetInfo', params: { targetId: target.id } })), { once: true });
      socket.addEventListener('message', event => {
        let data;
        try { data = JSON.parse(String(event.data)); } catch { return; }
        if (data.id !== 1) return;
        if (data.error) { finish(new Error('Relay target command rejected')); return; }
        const info = data.result?.targetInfo as TargetInfo | undefined;
        if (info?.targetId !== target.id || info.type !== 'page') { finish(); return; }
        finish(undefined, { id: target.id, session, ...(info.openerId ? { opener: info.openerId } : {}) });
      });
      socket.addEventListener('error', () => finish(new Error('Relay target connection error')), { once: true });
      socket.addEventListener('close', () => finish(new Error('Relay target connection lost')), { once: true });
    });
  }
  return {
    async snapshot() {
      const epoch = generation;
      const response = await fetch(`${endpoint}/json/list`, { signal: AbortSignal.timeout(2000) });
      if (!response.ok) throw new Error('Relay target list unavailable');
      const status = await response.json();
      if (!Array.isArray(status)) throw new Error('Invalid relay target list');
      const targets = status.filter((t: StatusTarget) => t.owner === 'relay' && t.browserControlSessionId) as StatusTarget[];
      for (const id of cache.keys()) if (!targets.some(t => t.id === id)) cache.delete(id);
      const result: RelayTarget[] = [];
      // New targets require scoped metadata. Known opener identity is immutable.
      for (const target of targets) {
        let value = cache.get(target.id);
        if (value?.session !== target.browserControlSessionId) value = undefined;
        if (!value) {
          let work = pending.get(target.id);
          if (!work) {
            work = inspect(target).finally(() => pending.delete(target.id));
            pending.set(target.id, work);
          }
          value = await work;
        }
        if (epoch !== generation) throw new Error('Relay target discovery closed');
        if (value) { cache.set(target.id, value); result.push(value); }
      }
      return result;
    },
    close() { generation++; cache.clear(); for (const socket of sockets) socket.close(); sockets.clear(); },
  };
}
