// Compatibility fix for Browser Control 0.7.1: native popup tabs must retain
// their existing Jev opener's ownership. No URL replay, global tab adoption,
// additional extension permission, or attachment of user-owned tabs.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const base = path.resolve('node_modules/@opencode-ai/browser-control');
const pkg = JSON.parse(await readFile(path.join(base, 'package.json'), 'utf8'));
if (pkg.version !== '0.7.1') throw new Error('Re-review popup compatibility patch before changing Browser Control version');
const marker = '// Jev owned-popup compatibility v1';
const replaceOnce = (text, from, to) => {
  if (text.split(from).length !== 2) throw new Error('Browser Control source contract changed; refusing to patch');
  return text.replace(from, to);
};
const extensionPath = path.join(base, 'extension/dist/background.js');
const relayPath = path.join(base, 'dist/cli.js');
let extension = await readFile(extensionPath, 'utf8');
let relay = await readFile(relayPath, 'utf8');
if (!extension.includes(marker)) {
  extension += `\n${marker}\nchrome.tabs.onCreated.addListener(tab => {
    if (Number.isInteger(tab.id) && Number.isInteger(tab.openerTabId)) {
      sendMessage({ method: "tabs.created", params: { tabId: tab.id, openerTabId: tab.openerTabId } });
    }
  });\n`;
}
if (!relay.includes(marker)) {
  relay = replaceOnce(relay, '  "tabs.removed",', '  "tabs.removed",\n  "tabs.created",');
  relay = replaceOnce(relay, '    if (extensionMethod === "toolbar.clicked") {', `    ${marker}
    if (extensionMethod === "tabs.created") {
      const tabId = message.params?.tabId;
      const openerTabId = message.params?.openerTabId;
      const opener = registry.tabTargets.get(openerTabId);
      const ownerId = opener?.browserControlSessionId;
      if (!Number.isInteger(tabId) || !Number.isInteger(openerTabId) || registry.tabTargets.has(tabId)
        || opener?.owner !== "relay" || typeof ownerId !== "string" || !ownerId.startsWith("jev-")) return;
      const originalOpener = opener;
      void Effect17.runPromise(Effect17.gen(function* () {
        if (!extensionRpc.isCurrent(socket) || generation !== extensionGeneration
          || registry.tabTargets.get(openerTabId) !== originalOpener) return;
        yield* rootLifecycle.attach({ tabId, owner: "relay", browserControlSessionId: ownerId,
          expectedExtensionGeneration: generation });
      })).catch(() => { console.error("Jev popup attachment failed"); });
      return;
    }
    if (extensionMethod === "toolbar.clicked") {`);
}
// Validate both patches completely before writing either file.
await writeFile(extensionPath, extension);
await writeFile(relayPath, relay);
console.log('Browser Control owned-popup compatibility patch ready (0.7.1)');
