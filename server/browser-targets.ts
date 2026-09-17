import type { CommandRunner } from './browser-transport.js';

interface Target { id: string; owner?: string; browserControlSessionId?: string }
interface State {
  active: string; owned: Set<string>; ids: Set<string>; checked: Set<string>;
  versions: Map<string, number>; pendingUntil: number;
}
/** Follow only targets whose CDP opener belongs to this run. Never mirror URLs. */
export function createTargetTracker(command: CommandRunner) {
  const runs = new Map<string, State>();
  function get(root: string): State {
    let run = runs.get(root);
    if (!run) { run = { active: root, owned: new Set([root]), ids: new Set(), checked: new Set(), versions: new Map(), pendingUntil: 0 }; runs.set(root, run); }
    return run;
  }
  return {
    active: (root: string) => get(root).active,
    owned: (root: string) => [...get(root).owned],
    forget: (root: string) => runs.delete(root),
    remember(root: string, session: string, meta: { targetId?: string; popupVersion?: number; localPopup?: boolean }) {
      const run = get(root);
      if (meta.targetId) run.ids.add(meta.targetId);
      if ((meta.popupVersion ?? 0) > (run.versions.get(session) ?? 0)) {
        run.versions.set(session, meta.popupVersion!); run.pendingUntil = Date.now() + 10_000;
      }
      if (meta.localPopup) run.pendingUntil = 0;
    },
    async discover(root: string): Promise<boolean> {
      const run = get(root);
      if (Date.now() > run.pendingUntil) return false;
      const status = JSON.parse(await command(['status', '--json'])) as { targets?: Target[] };
      const candidates = (status.targets ?? []).filter(t => t.owner === 'relay' && t.browserControlSessionId && !run.owned.has(t.browserControlSessionId) && !run.checked.has(t.id)).slice(0, 32);
      const matches: Target[] = [];
      for (const target of candidates) {
        try {
          const response = JSON.parse(await command(['execute', '--json', '--session', target.browserControlSessionId!, '--existing', `
            const probe = await page.context().newCDPSession(page);
            try {
              const info = (await probe.send("Target.getTargetInfo")).targetInfo;
              return { targetId: info.targetId, openerId: info.openerId };
            } finally { await probe.detach(); }
          `])) as { ok?: boolean; value?: { targetId?: string; openerId?: string } };
          if (!response.ok || response.value?.targetId !== target.id) continue;
          if (response.value.openerId && run.ids.has(response.value.openerId)) matches.push(target);
          else if (response.value.openerId) run.checked.add(target.id);
        } catch { /* A closing target is not evidence of an owned popup. */ }
      }
      if (matches.length > 1) throw new Error('Ambiguous owned popups: refresh and select a target explicitly');
      if (matches.length === 0) return false;
      const target = matches[0];
      run.active = target.browserControlSessionId!; run.owned.add(run.active);
      run.ids.add(target.id); run.pendingUntil = 0;
      return true;
    },
  };
}
