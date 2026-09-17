export interface ObservationMetrics {
    domExtractMs: number;
    examinedCandidates: number;
    totalMatches: number;
    mode: "full" | "incremental" | "focused";
    boundaryMs?: number;
    screenshotMs?: number;
    payloadBytes?: number;
}
export type RunStatus = "idle" | "running" | "complete" | "error";
export type ActionKind = "open_site" | "click_item" | "fill_item" | "type_text" | "press_enter" | "press_escape" | "scroll_down" | "scroll_up" | "back" | "wait" | "done" | "none";
export interface Candidate {
    ref: string;
    label: string;
    field?: FocusedField;
}
export interface FocusedField {
    ref?: string;
    type?: string;
    sensitive?: boolean;
    label: string;
    placeholder: string;
    value: string;
    isText: boolean;
}
export interface Observation {
    id: string;
    documentId?: string;
    readiness?: { documentState: DocumentReadyState; busy: boolean };
    metrics?: ObservationMetrics;
    pageText?: string;
    /** Compatibility input alias from the earlier remote collector. */
    pageContext?: string;
    snapshot: string;
    candidates: Candidate[];
    url: string;
    title: string;
    focusedField?: FocusedField;
    screenshotUrl?: string;
}
export interface PlannedAction {
    kind: ActionKind;
    target?: string;
    site?: string;
    url?: string;
    value?: string;
    observationId: string;
    confidence?: number;
    probabilities?: Record<string, number>;
}
export interface RunEvent {
    id: number;
    type: string;
    at: string;
    message: string;
    data?: Record<string, unknown>;
}
export interface PhaseTimings {
    writerMs?: number;
    browserMs?: number;
    observeMs?: number;
    planMs?: number;
    actMs?: number;
    totalMs?: number;
}
export interface Run {
    id: string;
    goal: string;
    status: RunStatus;
    events: RunEvent[];
    createdAt: string;
    stepCount: number;
    observation?: Observation;
    error?: string;
    screenshotPath?: string;
    stopped?: boolean;
    timings?: PhaseTimings;
}
