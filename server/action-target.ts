/** Resolve the exact observed node, not a selector another node can inherit. */
export function targetSource(ref?: string, documentId?: string): string {
  return `page.evaluateHandle(({ ref, documentId }) => {
    const registry = window.__jevRefs;
    const node = registry?.nodes.get(ref);
    if (!registry || registry.documentId !== documentId || !node?.isConnected) {
      throw new Error("Stale target: refresh before acting");
    }
    return node;
  }, ${JSON.stringify({ ref, documentId })})`;
}
