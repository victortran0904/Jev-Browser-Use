/** Action scripts retain an element handle instead of trusting mutable focus. */
export function focusedFillScript(documentId: string | undefined, text: string, label = "focused field"): string {
  const input = JSON.stringify({ documentId, text });
  return `
    const input = ${input};
    const observer = jevSession.observers?.get(page);
    if (!observer) throw new Error("Stale document; observe again");
    const handle = await observer.evaluateHandle(
      (value, documentId) => value.resolveFocus(documentId), input.documentId
    );
    try {
      const element = handle.asElement();
      if (!element) throw new Error("Stale focused element");
      await element.fill(input.text, { timeout: 5000 });
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
    const handle = await observer.evaluateHandle(
      (value, input) => value.resolveFill(input.ref, input.documentId), input
    );
    try {
      const element = handle.asElement();
      if (!element) throw new Error("Stale text field");
      await element.fill(input.text, { timeout: 5000 });
    } finally {
      await handle.dispose();
    }
    return ${JSON.stringify(`filled ${label}`)};
  `;
}
