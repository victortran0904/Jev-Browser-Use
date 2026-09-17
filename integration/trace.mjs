const kinds=new Set(['open_site','click_item','fill_item','type_text','press_enter','press_escape','scroll_down','scroll_up','back','wait','done','none']);
export function traceStep(action,observation,steps=[]) {
  const target=observation.candidates.find(c=>c.ref===action.target);
  return {kind:kinds.has(action.kind)?action.kind:'invalid',targetIndex:steps.findIndex(s=>s[1]&&target?.label.includes(s[1])),fieldIndex:steps.findIndex(s=>s[0]==='fill'&&observation.focusedField?.label.includes(s[1])),fieldNonempty:!!observation.focusedField?.value,candidates:observation.candidates.length,confidence:Number.isFinite(action.confidence)?action.confidence:null};
}
export function failureCategory(error) {
  const message=String(error?.message||error||'');
  return /401|invalid.api.key|authentication/i.test(message)?'authentication':/403|forbidden/i.test(message)?'permission':/429|quota/i.test(message)?'rate-limit':/timeout|timed.out|aborted/i.test(message)?'timeout':/503|temporar.*unavailable|overload/i.test(message)?'provider-unavailable':/request budget/i.test(message)?'request-budget':/stale/i.test(message)?'stale-state':/step.limit/i.test(message)?'step-limit':/missing.*secret/i.test(message)?'missing-secrets':/confidence/i.test(message)?'low-confidence':/six repeated|ineffective/i.test(message)?'no-progress':/completion evidence|verified dated flight/i.test(message)?'goal-not-proven':/target command rejected/i.test(message)?'target-discovery-rejected':'assertion-or-runtime-failure';
}
