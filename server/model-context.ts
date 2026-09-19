import type { Observation } from './types.js';

/** Model-facing state excludes browser-internal identity and stale-action tokens. */
export function modelPage(observation: Observation) {
  const field = observation.focusedField;
  return {
    url: observation.url,
    title: observation.title,
    readiness: observation.readiness ? {
      documentState: observation.readiness.documentState,
      busy: observation.readiness.busy,
    } : null,
    focused_field: field ? { label: field.label, placeholder: field.placeholder, value: field.value, isText: field.isText } : null,
    // Shared across independent TypeSafe questions; no private DOM signatures.
    controls: observation.candidates.map(item => ({
      ref: item.ref, label: item.label,
      ...(item.field ? { editable: item.field.isText && !item.field.sensitive,
        preferred_action: item.field.preferredAction,
        value: item.field.sensitive ? "" : item.field.value.slice(0, 120) } : {}),
    })),
    semantic_dom: observation.pageText ?? observation.pageContext ?? observation.snapshot,
  };
}
