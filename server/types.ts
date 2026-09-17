export type RunStatus = "idle" | "running" | "complete" | "error";
export type ActionKind = "click" | "fill" | "press_enter" | "press_escape" | "scroll_down" | "scroll_up" | "back" | "wait" | "done" | "none";
export interface Candidate { ref: string; label: string }
export interface Observation { id: string; snapshot: string; candidates: Candidate[]; url: string; title: string; screenshotUrl?: string }
export interface PlannedAction { kind: ActionKind; target?: string; value?: string; observationId: string; confidence?: number; probabilities?: Record<string, number> }
export interface RunEvent { id: number; type: string; at: string; message: string; data?: Record<string, unknown> }
export interface Run { id: string; goal: string; startUrl: string; values: string[]; status: RunStatus; events: RunEvent[]; createdAt: string; stepCount: number; observation?: Observation; error?: string; screenshotPath?: string; stopped?: boolean }
