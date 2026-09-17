import type { Observation } from './types.js';

/** Model-facing state excludes browser-internal identity and stale-action tokens. */
export function modelPage(observation: Observation) {
  const field=observation.focusedField;
  return {
    url: observation.url,
    title: observation.title,
    focused_field: field ? {label:field.label,placeholder:field.placeholder,value:field.value,isText:field.isText} : null,
    semantic_dom: observation.pageContext ?? observation.snapshot,
  };
}
