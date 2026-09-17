import { createRelayTargetSource, type TargetSource } from "./relay-targets.js";
import { defaultCommandRunner, type CommandRunner } from "./browser-transport.js";
export { defaultCommandRunner, type CommandRunner } from "./browser-transport.js";
import { mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Candidate, Observation, PlannedAction } from "./types.js";
const observerSource = readFileSync(new URL("./page-observer.js", import.meta.url), "utf8");
const actionKinds = new Set(["open_site", "click_item", "type_text", "press_enter", "press_escape", "scroll_down", "scroll_up", "back", "wait", "done", "none"]);
export function parseSnapshot(snapshot: string): Candidate[] {
  const candidates: Candidate[] = [];
  for (const raw of snapshot.split("\n")) {
    const match = raw.match(/^(.*?)\s*\[ref=([\w-]+)\]/);
    if (match) candidates.push({ref:match[2], label:match[1].trim().replace(/^[-\s]+/, "")});
    if (candidates.length === 240) break;
  }
  return candidates;
}
export function validateAction(action: PlannedAction, observation: Observation): PlannedAction {
  if (action.observationId !== observation.id) throw new Error("Stale observation: refresh before acting");
  if (!actionKinds.has(action.kind)) throw new Error("Unsupported browser action");
  if (action.kind === "click_item" && !observation.candidates.some(item => item.ref === action.target)) throw new Error("Target is not in the current observation");
  if (action.kind === "type_text" && !observation.focusedField?.isText) throw new Error("No browser text field is focused");
  return action;
}
interface Envelope { ok: boolean; value?: unknown; text?: string; error?: {message?:string}|string }
export interface BrowserBoundaryOptions { settleTimeoutMs?: number; targetSource?: TargetSource; }
export interface BrowserBoundary {
  begin(runId: string): Promise<void>;
  observe(runId: string, screenshotPath?: string): Promise<Observation>;
  open(runId: string, url: string): Promise<string>;
  act(runId: string, action: PlannedAction, observation: Observation): Promise<string>;
  close?(runId: string): Promise<void>;
}
export function createBrowserBoundary(command: CommandRunner = defaultCommandRunner, options: BrowserBoundaryOptions = {}): BrowserBoundary {
  const sessions = new Set<string>();
  const activeSessions = new Map<string,string>();
  const ownedTargets = new Map<string,Set<string>>();
  const ownedSessions = new Map<string,Set<string>>();
  const source = options.targetSource ?? (command === defaultCommandRunner ? createRelayTargetSource() : undefined);
  const latest = new Map<string,string>();
  const closed = new Set<string>();
  const pending = new Map<string,Promise<unknown>>();
  async function syncTarget(runId:string) {
    if (!source) return;
    const targets=await source.snapshot();
    const owned=ownedTargets.get(runId)??new Set<string>();
    const root=targets.find(t=>t.session===`jev-${runId}`);
    if(root)owned.add(root.id);
    const children=targets.filter(t=>t.opener&&owned.has(t.opener)&&!owned.has(t.id));
    for(const child of children) {
      owned.add(child.id); sessions.add(child.session);
      const all=ownedSessions.get(runId)??new Set([`jev-${runId}`]);all.add(child.session);ownedSessions.set(runId,all);
      activeSessions.set(runId,child.session); latest.delete(runId);
    }
    ownedTargets.set(runId,owned);
  }
  function execute(runId: string, code: string): Promise<unknown> {
    if(closed.has(runId)) return Promise.reject(new Error("Browser run closed"));
    const task=(pending.get(runId)??Promise.resolve()).catch(()=>{}).then(()=>executeNow(runId,code));
    pending.set(runId,task);
    task.finally(()=>{if(pending.get(runId)===task) pending.delete(runId);}).catch(()=>{});
    return task;
  }
  async function executeNow(runId: string, code: string): Promise<unknown> {
    if(closed.has(runId)) throw new Error("Browser run closed");
    const session=activeSessions.get(runId)??`jev-${runId}`;
    if (!sessions.has(session)) { await command(["session","new",session]); sessions.add(session); }
    if(closed.has(runId)) throw new Error("Browser run closed");
    const envelope=JSON.parse(await command(["execute","--json","--session",session,code])) as Envelope;
    if (!envelope.ok) throw new Error(typeof envelope.error === "string" ? envelope.error : envelope.error?.message ?? envelope.text ?? "Browser Control failed");
    return envelope.value;
  }
  const prefix = `
    state.__jevPages ??= new Set();
    const watch = child => {
      if(state.__jevPages.has(child)) return;
      state.__jevPages.add(child);
      child.on("popup", popup => { watch(popup); state.__jevNext=popup; });
    };
    watch(page);
    if(state.__jevNext && !state.__jevNext.isClosed()) {state.__jevPage=state.__jevNext; state.__jevNext=null;}
    const p=state.__jevPage || page;
    if(p.isClosed()) throw new Error("Browser page closed");
  `;
  const observer = `
    let observer=state.__jevObserver;
    if (observer && state.__jevObserverPage!==p) {await observer.dispose().catch(()=>{}); observer=null;}
    if (observer) {
      try { await observer.evaluate(api=>api.capture && true); }
      catch { await observer.dispose().catch(()=>{}); observer=null; }
    }
    if (!observer) {observer=state.__jevObserver=await p.evaluateHandle(${JSON.stringify(observerSource)}); state.__jevObserverPage=p;}
  `;
  return {
    async begin(runId) { await execute(runId, `await page.goto("about:blank"); return true;`); },
    async observe(runId,screenshotPath) {
      if (screenshotPath) await mkdir(path.dirname(screenshotPath), {recursive:true});
      if(closed.has(runId)) throw new Error("Browser run closed");
      const started=performance.now();
      await syncTarget(runId);
      const value=await execute(runId, `${prefix}\n${observer}\nconst dom=await observer.evaluate(api=>api.capture());\n${screenshotPath ? `await p.screenshot({path:${JSON.stringify(screenshotPath)},scale:"css"});` : ""}\nreturn dom;`) as {candidates?:Candidate[];url?:string;title?:string;documentId?:string;pageText?:string;focusedField?:Observation["focusedField"];metrics?:Observation["metrics"]};
      const candidates=value.candidates ?? [];
      const observation:Observation={id:randomUUID(),url:String(value.url||""),title:String(value.title||""),documentId:value.documentId,candidates,snapshot:`${candidates.map((c:Candidate)=>`${c.label} [ref=${c.ref}]`).join("\n")}\n\nVisible page text:\n${value.pageText||""}`.slice(0,30000),pageContext:value.pageText||"",...(value.focusedField?{focusedField:value.focusedField}:{}),metrics:{...value.metrics,observeMs:performance.now()-started},...(screenshotPath?{screenshotUrl:`/api/runs/${runId}/screenshot`}:{})};
      latest.set(runId,observation.id);
      return observation;
    },
    async open(runId,rawUrl) {
      const url=new URL(rawUrl);
      if (url.protocol!=="https:") return "open_site refused: writer did not provide a valid HTTPS URL";
      latest.delete(runId);
      const result=await execute(runId,`${prefix}\nawait p.goto(${JSON.stringify(url.href)}); return p.url();`);
      return `opened ${String(result||url.href)}`;
    },
    async act(runId,action,observation) {
      validateAction(action,observation);
      if (latest.has(runId) && latest.get(runId)!==observation.id) throw new Error("Stale observation: newer observation exists");
      const target=["type_text","press_enter"].includes(action.kind) ? observation.focusedField : observation.candidates.find(c=>c.ref===action.target);
      const request={ref:target?.ref,signature:target?.signature,documentId:observation.documentId,text:action.kind==="type_text",focused:["type_text","press_enter"].includes(action.kind)};
      const resolve=`if(!state.__jevObserver || state.__jevObserverPage!==p) throw new Error("Stale observation: missing document");\nconst h=await state.__jevObserver.evaluateHandle((api,request)=>api.resolve(request),${JSON.stringify(request)}); const target=h.asElement(); if(!target) throw new Error("Stale observation: missing element");`;
      const scripts:Record<string,string>={
        click_item:`${resolve}\ntry {await target.click({timeout:5000}); return ${JSON.stringify(`clicked ${(target?.label ?? "item").split(" [value=")[0]}`)};} finally {await h.dispose();}`,
        type_text:`${resolve}\ntry {await target.fill(${JSON.stringify(action.value??"")},{timeout:2000}); return ${JSON.stringify(`typed text into ${observation.focusedField?.label || "focused field"}`)};} finally {await h.dispose();}`,
        press_enter:observation.focusedField ? `${resolve}\ntry {await p.keyboard.press("Enter"); return "pressed Enter";} finally {await h.dispose();}` : `await p.keyboard.press("Enter"); return "pressed Enter";`,
        press_escape:`await p.keyboard.press("Escape"); return "pressed Escape";`,
        scroll_down:`await p.mouse.wheel(0,650); return "scrolled down";`,
        scroll_up:`await p.mouse.wheel(0,-650); return "scrolled up";`,
        back:`await p.goBack(); return "went back";`,
        wait:`await p.waitForTimeout(1000); return "waited";`,
      };
      if(!scripts[action.kind]) throw new Error(`Action ${action.kind} cannot be executed by the browser boundary`);
      const guard=`if(!state.__jevObserver || state.__jevObserverPage!==p) throw new Error("Stale observation: target changed"); await state.__jevObserver.evaluate((api,id)=>api.assertDocument(id),${JSON.stringify(observation.documentId)});`;
      return String(await execute(runId,`${prefix}\n${guard}\n${scripts[action.kind]}`));
    },
    async close(runId) {
      closed.add(runId); latest.delete(runId);
      await pending.get(runId)?.catch(()=>{});
      const all=ownedSessions.get(runId)??new Set([`jev-${runId}`]);
      for(const session of all) {
        if(!sessions.has(session)) continue;
        try {
          await command(["execute","--json","--session",session,`if(state.__jevObserver) { await state.__jevObserver.evaluate(api=>api.release()).catch(()=>{}); await state.__jevObserver.dispose().catch(()=>{}); } for(const owned of state.__jevPages||[]) {if(owned!==page && !owned.isClosed()) await owned.close().catch(()=>{});} return true;`]);
        } finally {
          await command(["session","delete",session]); sessions.delete(session);
        }
      }
      ownedSessions.delete(runId);ownedTargets.delete(runId);activeSessions.delete(runId);
      if(sessions.size===0)source?.close();
    },
  };
}
export const browserBoundary=createBrowserBoundary();
