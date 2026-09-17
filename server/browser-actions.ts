/** Only controls declaring a pop-up editor wait for its asynchronous focus transfer.
 * Ordinary fields resolve immediately; a missing pop-up never replays the fill. */
const editorReadinessScript = `
  await page.waitForFunction(el => {
    const popup = el.getAttribute("aria-haspopup");
    if (el.getAttribute("role") !== "combobox" && popup !== "dialog" && popup !== "listbox") return true;
    if (!el.isConnected || el.getAttribute("aria-expanded") === "true") return true;
    const active = document.activeElement;
    return active && active !== el && active !== document.body && active.getBoundingClientRect().width > 0;
  }, element, { timeout: 750 }).catch(error => {
    if (error.name !== "TimeoutError") throw error;
  });
`;

/** Action scripts retain an element handle instead of trusting mutable focus. */
export function focusedFillScript(documentId: string | undefined, text: string, label = "focused field"): string {
  const input = JSON.stringify({ documentId, text });
  return `
    const input = ${input};
    const observer = jevSession.observers?.get(page);
    if (!observer) throw new Error("Stale document; observe again");
    // Only resolution is recoverable: fill and disposal failures stay terminal.
    let handle;
    try {
      handle = await observer.evaluateHandle(
      (value, input) => {
        const element = value.resolveFocus(input.documentId);
        const current = "value" in element ? String(element.value) : element.textContent || "";
        return current === input.text ? null : element;
      }, input
    );
    } catch { return { _jevOutcome: "stale-observation", dispatched: false }; }
    try {
      const element = handle.asElement();
      if (!element) return "fill refused: field already has the requested value; choose another useful action";
      await element.fill(input.text, { timeout: 5000 });
      ${editorReadinessScript}
    } finally {
      await handle.dispose();
    }
    return ${JSON.stringify(`typed into ${label}`)};
  `;
}

export function targetFillScript(documentId: string | undefined, ref: string | undefined, text: string, label = "observed text field"): string {
  const input = JSON.stringify({ documentId, ref, text });
  return `
    const input = ${input};
    const observer = jevSession.observers?.get(page);
    if (!observer) throw new Error("Stale document; observe again");
    // Only resolution is recoverable: fill and disposal failures stay terminal.
    let handle;
    try {
      handle = await observer.evaluateHandle(
      (value, input) => {
        const element = value.resolveFill(input.ref, input.documentId);
        const current = "value" in element ? String(element.value) : element.textContent || "";
        return current === input.text ? null : element;
      }, input
    );
    } catch { return { _jevOutcome: "stale-observation", dispatched: false }; }
    try {
      const element = handle.asElement();
      if (!element) return "fill refused: field already has the requested value; choose another useful action";
      await element.fill(input.text, { timeout: 5000 });
      ${editorReadinessScript}
    } finally {
      await handle.dispose();
    }
    return ${JSON.stringify(`filled ${label}`)};
  `;
}
