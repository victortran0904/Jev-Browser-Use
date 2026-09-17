import { describe, expect, it } from 'vitest';
import { verifyPatchInput } from '../scripts/browser-control-compat.mjs';
describe('version-pinned popup compatibility', () => {
  it('refuses an unexpected dependency version instead of modifying unknown code', () => {
    expect(() => verifyPatchInput('0.7.2', 'dist/cli.js', 'unknown')).toThrow(/version/i);
  });
});
it('rejects modified dependency bytes even when the version matches', () => {
  expect(() => verifyPatchInput('0.7.1', 'dist/cli.js', 'modified dependency')).toThrow(/checksum/i);
});
