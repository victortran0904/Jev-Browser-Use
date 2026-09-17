import {setTimeout as delay} from 'node:timers/promises';

/** Test harness pacing only. Does not alter browser timings or production calls. */
export function createRequestGate({spacingMs,now=()=>performance.now(),sleep=delay}) {
  if(!Number.isFinite(spacingMs)||spacingMs<0) throw new Error('Invalid request spacing');
  let next=0;
  return async()=>{
    const current=now();
    const slot=Math.max(current,next);
    next=slot+spacingMs; // Reserve synchronously before yielding to other calls.
    const wait=Math.max(0,slot-current);
    if(wait) await sleep(wait);
    return wait;
  };
}
