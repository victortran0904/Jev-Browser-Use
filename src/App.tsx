import { FormEvent, useEffect, useState } from "react";

type Status = "idle" | "running" | "complete" | "error";
type Event = { id: number; type: string; at: string; message: string; data?: Record<string, unknown> };
type Run = { id: string; goal: string; status: Status; events: Event[]; observation?: { url: string; title: string; screenshotUrl?: string }; error?: string };

const hostname = (value: string) => { try { return new URL(value).hostname || "Set start URL"; } catch { return "Set start URL"; } };

export default function App() {
  const [run, setRun] = useState<Run>();
  const [goal, setGoal] = useState("");
  const [startUrl, setStartUrl] = useState("https://example.com");
  const [values, setValues] = useState("");
  const [contextOpen, setContextOpen] = useState(false);

  async function refresh(id?: string) {
    const response = await fetch(id ? `/api/runs/${id}` : "/api/runs");
    if (!response.ok) return;
    const data = await response.json();
    setRun(Array.isArray(data) ? data[0] : data);
  }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!run?.id || run.status !== "running") return;
    const stream = new EventSource(`/api/runs/${run.id}/events`);
    stream.onmessage = () => void refresh(run.id);
    return () => stream.close();
  }, [run?.id, run?.status]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!goal.trim()) return;
    const response = await fetch("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal, startUrl, values: values.split("\n").map((value) => value.trim()).filter(Boolean) }) });
    const data = await response.json();
    if (response.ok) { setRun(data); setGoal(""); }
    else setRun({ id: "error", goal, status: "error", events: [], error: data.error ?? "Unable to start" });
  }
  async function stop() { if (!run) return; const response = await fetch(`/api/runs/${run.id}/stop`, { method: "POST" }); if (response.ok) setRun(await response.json()); }

  const status = run?.status ?? "idle";
  return <main className="app">
    <header className="topbar"><div className="brand"><span className="mark">J</span>Jev Browser</div><div className="session"><span className={`dot ${status}`} />{status}</div></header>
    <section className="workspace">
      <div className="browser panel">
        <div className="panel-title"><span>Browser view</span><span className="browser-url">{run?.observation?.url ?? "No active page"}</span></div>
        <div className="agent-screen">
          <div className="screen-bar"><span>● ● ●</span><span>{run?.observation?.title ?? "Agent screen"}</span><span>DOM</span></div>
          {run?.observation?.screenshotUrl ? <img src={`${run.observation.screenshotUrl}?t=${run.events.length}`} alt="Latest browser state" /> : <div className="screen-empty"><div className="crosshair">+</div><h2>Ready to browse</h2><p>Send a goal. Jev will read the accessibility snapshot, choose one action, and repeat.</p></div>}
        </div>
        {run?.error && <div className="error-line">{run.error}</div>}
      </div>
      <aside className="timeline panel">
        <div className="panel-title"><span>Action log</span><span>{run?.events.length ?? 0}</span></div>
        <div className="events">{run?.events.length ? run.events.map((item) => <div className={`event ${item.type}`} key={item.id}><div className="event-meta"><span>{item.type === "user_message" ? "You" : "Agent"}</span><time>{new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><p>{item.message}</p>{item.type === "plan" && <span className="tool-chip">{String(item.data?.kind ?? "decision")}</span>}</div>) : <div className="empty-small">Actions will appear here.</div>}</div>
      </aside>
    </section>
    <form className="composer" onSubmit={submit}>
      <div className="compose-row"><textarea aria-label="Message" rows={2} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Tell Jev what to do in the browser…" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />{status === "running" ? <button type="button" className="stop" onClick={stop}>Stop</button> : <button className="send" disabled={!goal.trim()} aria-label="Run task">↗</button>}</div>
      <div className="context-row"><button type="button" className="context-toggle" onClick={() => setContextOpen(!contextOpen)}>＋ Context <span>{hostname(startUrl)}</span></button><span>Enter to run · Shift+Enter for newline</span></div>
      {contextOpen && <div className="context-panel"><label>Start URL<input value={startUrl} onChange={(event) => setStartUrl(event.target.value)} type="url" required /></label><label>Exact fill values<textarea value={values} onChange={(event) => setValues(event.target.value)} rows={2} placeholder="One value per line" /></label></div>}
    </form>
  </main>;
}
