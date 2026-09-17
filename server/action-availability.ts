import type { Observation } from './types.js';

/** Restrict model choices to actions supported by the current observation. */
export function availableActions(criteria: Record<string, string>, observation: Observation): Record<string, string> {
  const result = { ...criteria };
  if (!observation.candidates.length) delete result.click_item;
  if (!observation.candidates.some(item => item.field?.isText && !item.field.sensitive)) delete result.fill_item;
  if (!observation.focusedField?.isText || observation.focusedField.sensitive) {
    delete result.type_text;
    delete result.press_enter;
  }
  return result;
}
