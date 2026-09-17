export type RunStatus = "idle" | "running" | "complete" | "error";
export type ActionKind = "open_site" | "click_item" | "type_text" | "press_enter" | "press_escape" | "scroll_down" | "scroll_up" | "back" | "wait" | "done" | "none";
export interface Candidate { ref: string; label: string }
export interface FocusedField { label: string; placeholder: string; value: string; isText: boolean }
export interface Observation { id: string; snapshot: string; candidates: Candidate[]; url: string; title: string; focusedField?: FocusedField; screenshotUrl?: string }
export interface PlannedAction { kind: ActionKind; target?: string; site?: string; url?: string; value?: string; observationId: string; confidence?: number; probabilities?: Record<string, number> }
export interface RunEvent { id: number; type: string; at: string; message: string; data?: Record<string, unknown> }
export interface PhaseTimings { observeMs?: number; planMs?: number; actMs?: number; totalMs?: number }
export interface Run { id: string; goal: string; status: RunStatus; events: RunEvent[]; createdAt: string; stepCount: number; observation?: Observation; error?: string; screenshotPath?: string; stopped?: boolean; timings?: PhaseTimings }
