import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const assets = new URL('./patches/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', assets), 'utf8'));
const sha = source => createHash('sha256').update(source).digest('hex');
export function verifyPatchInput(version, name, source) {
  if (version !== '0.7.1') throw new Error('Unsupported Browser Control version; review popup compatibility before upgrading');
  const entry = manifest[name];
  if (!entry) throw new Error('Unknown compatibility target');
  const digest = sha(source);
  if (digest === entry.patched) return 'patched';
  if (digest === entry.original) return 'original';
  throw new Error('Browser Control file checksum mismatch; refusing to modify unknown code');
}
export async function applyCompatibility(root = path.resolve('node_modules/@opencode-ai/browser-control')) {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const pending = [];
  for (const name of Object.keys(manifest)) {
    const file = path.join(root, name);
    const source = await readFile(file, 'utf8');
    if (verifyPatchInput(pkg.version, name, source) === 'patched') continue;
    let output;
    // Preserve the relay's existing ownership checks; add only its owned-tab event.
    if (name === 'dist/cli.js') {
      const event = 'var extensionEventMethods = new Set(extensionEventMethodValues);';
      const anchor = '    if (extensionMethod === "debugger.attached") {';
      const handler = await readFile(new URL('popup-relay.txt', assets), 'utf8');
      output = source.replace(event, 'var extensionEventMethods = new Set([...extensionEventMethodValues, "tabs.created"]);');
      output = output.replace(anchor, handler + anchor);
    } else {
      output = source + await readFile(new URL('popup-extension.txt', assets), 'utf8');
    }
    if (sha(output) !== manifest[name].patched) throw new Error('Compatibility output checksum mismatch');
    pending.push([file, output]);
  }
  // Validate every input before writing either of the paired protocol changes.
  for (const [file, output] of pending) await writeFile(file, output);
  return pending.length;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await applyCompatibility();
  console.log('Verified Browser Control 0.7.1 owned-popup compatibility');
}
