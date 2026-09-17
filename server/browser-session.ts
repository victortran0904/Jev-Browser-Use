/** Browser Control's documented `state` object lives across execute calls.
 * Track only pages causally opened by this run; never infer ownership from a global tab list. */
export const sessionPrelude = `
  if (!state.__jevBrowser) {
    const session = { active: page, pages: new Map(), switched: false };
    const track = (owned) => {
      if (session.pages.has(owned)) return;
      const onPopup = (child) => { track(child); session.active = child; session.switched = true; };
      owned.on("popup", onPopup);
      session.pages.set(owned, onPopup);
    };
    track(page);
    state.__jevBrowser = session;
  }
  const jevSession = state.__jevBrowser;
  if (jevSession.active.isClosed()) {
    const remaining = [...jevSession.pages.keys()].reverse().find(candidate => !candidate.isClosed());
    if (!remaining) throw new Error("Run-owned browser target is closed");
    jevSession.active = remaining;
  }
  page = jevSession.active;
`;

export const sessionCleanup = `
  const session = state.__jevBrowser;
  if (session) {
    for (const [owned, listener] of session.pages) {
      owned.off("popup", listener);
      if (owned !== page && !owned.isClosed()) await owned.close().catch(() => {});
    }
    for (const observer of session.observers?.values() ?? []) {
      await observer.evaluate(value => value.disconnect()).catch(() => {});
      await observer.dispose().catch(() => {});
    }
    session.observers?.clear();
    session.pages.clear();
    delete state.__jevBrowser;
  }
  return true;
`;
