import { afterEach, expect, it, vi } from 'vitest';
import { createWriter } from '../server/writer.js';

const observation = {
  id: 'writer-test', url: 'https://example.com', title: 'Search', snapshot: '', candidates: [],
  focusedField: { label: 'Origin', placeholder: '', value: '', isText: true },
};
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function providerResponse(text: string) {
  vi.stubEnv('GEMINI_KEY', 'synthetic-test-key');
  vi.stubGlobal('fetch', async () => Response.json({
    candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }],
  }));
}

it('does not turn a string-valued false into permission to fill a field', async () => {
  providerResponse(JSON.stringify({ fill: 'false', text: 'unwanted input', reason: 'declined' }));
  await expect(createWriter().generateText({ goal: 'Search', history: [], observation }))
    .rejects.toThrow(/structured|schema|invalid/i);
});

it('does not turn a string-valued false into a URL navigation decision', async () => {
  providerResponse(JSON.stringify({ ok: 'false', url: 'https://example.com', reason: 'declined' }));
  await expect(createWriter().generateUrl({ goal: 'Search', history: [] }))
    .rejects.toThrow(/structured|schema|invalid/i);
});

it('recovers one timed-out model request without changing the model or duplicating browser input', async () => {
  vi.stubEnv('GEMINI_KEY', 'synthetic-test-key');
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (input: string | URL | Request) => {
    urls.push(input instanceof Request ? input.url : String(input));
    if (urls.length === 1) throw new DOMException('Request deadline', 'TimeoutError');
    return Response.json({ candidates: [{ content: { parts: [{
      text: JSON.stringify({ fill: true, text: 'Hanoi', reason: 'Origin' }),
    }] }, finishReason: 'STOP' }] });
  });
  await expect(createWriter().generateText({ goal: 'Search', history: [], observation }))
    .resolves.toMatchObject({ fill: true, text: 'Hanoi' });
  expect(urls).toHaveLength(2);
  expect(urls[0]).toBe(urls[1]);
});

it.each(['TimeoutError', 'AbortError'])('stops safely when the provider keeps failing with %s', async name => {
  vi.stubEnv('GEMINI_KEY', 'synthetic-test-key');
  let requests = 0;
  vi.stubGlobal('fetch', async () => { requests++; throw new DOMException('Synthetic failure', name); });
  await expect(createWriter().generateText({ goal: 'Search', history: [], observation }))
    .rejects.toMatchObject({ name });
  expect(requests).toBe(name === 'TimeoutError' ? 2 : 1);
});

it.each([true, false])('preserves a properly typed fill=%s response', async fill => {
  providerResponse(JSON.stringify({ fill, text: 'Hanoi', reason: 'Origin' }));
  await expect(createWriter().generateText({ goal: 'Search', history: [], observation }))
    .resolves.toEqual({ fill, text: 'Hanoi', reason: 'Origin' });
});
