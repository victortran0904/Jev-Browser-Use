import { useEffect, useState } from "react";
import { BorderBeam } from "border-beam";
import { MetalFx } from "metal-fx";
import { RotateCcw } from "lucide-react";
import { InputBar, type InputBarStatus } from "@/components/ui/input-bar";
import { ThinkingOrb } from "@/components/ui/thinking-orbs";

type Status = "idle" | "running" | "complete" | "error";
type Event = { id: number; type: string; at: string; message: string; data?: Record<string, unknown> };
type Run = { id: string; goal: string; status: Status; events: Event[]; error?: string };

export default function App() {
  const [run, setRun] = useState<Run>();
  const [goal, setGoal] = useState("");
  const [clearedLog, setClearedLog] = useState<{ runId?: string; eventCount: number; error?: string }>();

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
    stream.onmessage = (messageEvent) => {
      try {
        const event = JSON.parse(messageEvent.data) as Event;
        setRun((prev) => {
          if (!prev || prev.id !== run.id) return prev;
          if (prev.events.some((e) => e.id === event.id)) return prev;
          const nextEvents = [...prev.events, event];
          let nextStatus = prev.status;
          let nextError = prev.error;
          if (event.type === "run_complete" || event.type === "run_stopped") {
            nextStatus = "complete";
          } else if (event.type === "run_error") {
            nextStatus = "error";
            nextError = event.message;
          }
          return {
            ...prev,
            status: nextStatus,
            error: nextError,
            events: nextEvents,
          };
        });
      } catch {
        void refresh(run.id);
      }
    };
    return () => stream.close();
  }, [run?.id, run?.status]);

  async function submitGoal(content: string) {
    if (!content.trim()) return;
    const response = await fetch("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: content }) });
    const data = await response.json();
    if (response.ok) { setRun(data); setGoal(""); setClearedLog(undefined); }
    else setRun({ id: "error", goal: content, status: "error", events: [], error: data.error ?? "Unable to start" });
  }

  async function stop() {
    if (!run) return;
    const response = await fetch(`/api/runs/${run.id}/stop`, { method: "POST" });
    if (response.ok) setRun(await response.json());
  }

  const status = run?.status ?? "idle";
  const inputStatus: InputBarStatus = status === "running" ? "streaming" : status === "error" ? "error" : "ready";
  const clearedEventCount = clearedLog && clearedLog.runId === run?.id ? clearedLog.eventCount : 0;
  const visibleEvents = run?.events.slice(clearedEventCount) ?? [];
  const visibleError = run?.error === clearedLog?.error && run?.id === clearedLog?.runId ? undefined : run?.error;
  const hasActivity = visibleEvents.length > 0 || Boolean(visibleError);
  const clearLog = () => setClearedLog({ runId: run?.id, eventCount: run?.events.length ?? 0, error: run?.error });

  return (
    <main className="app-shell" data-theme="dark">
      <div className="task-shell">
        <section className="prompt-stage">
          <h1>Give Jev a task</h1>
          <div className="composer">
            <BorderBeam size="md" colorVariant="colorful" strength={0.7} active={status !== "running"} theme="dark" className="composer-beam">
              <InputBar
                value={goal}
                onChange={setGoal}
                onSend={({ content }) => void submitGoal(content)}
                onStop={() => void stop()}
                status={inputStatus}
                placeholder="Ask Jev to do something in the browser"
              />
            </BorderBeam>
            <p className="composer-hint">Enter to run · Shift+Enter for a new line</p>
          </div>
        </section>

        {status === "running" && (
          <div className="thinking-pill" role="status" aria-label="Jev is solving the task">
            <span className="orb-wrap"><ThinkingOrb state="solving" size={64} theme="dark" /></span>
            <span>Solving….</span>
          </div>
        )}

        {hasActivity && (
          <section className="activity-stream" aria-label="Task activity">
            <div className="activity-tools">
              <MetalFx preset="silver" variant="circle" strength={0.9} theme="dark" innerShadow>
                <button type="button" className="clear-button" onClick={clearLog} aria-label="Clear action log" title="Clear activity">
                  <RotateCcw size={17} strokeWidth={1.8} />
                </button>
              </MetalFx>
            </div>
            {visibleError && <div className="error-line">{visibleError}</div>}
            <div className="events">
              {visibleEvents.map((item) => (
                <div className={`event ${item.type}`} key={item.id}>
                  <div className="event-meta">
                    <span>{item.type === "user_message" ? "You" : "Jev"}</span>
                    <time>{new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                  </div>
                  <p>{item.message}</p>
                  {item.type === "plan" && <span className="tool-chip">{String(item.data?.kind ?? "decision")}</span>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
