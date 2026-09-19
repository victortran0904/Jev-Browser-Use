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

it('accepts a valid text decision when the optional explanation is omitted', async () => {
  providerResponse(JSON.stringify({ fill: true, text: 'Hanoi' }));
  await expect(createWriter().generateText({ goal: 'Search', history: [], observation }))
    .resolves.toEqual({ fill: true, text: 'Hanoi', reason: '' });
});

it('accepts a valid URL decision without an optional explanation', async () => {
  providerResponse(JSON.stringify({ ok: true, url: 'https://example.com' }));
  await expect(createWriter().generateUrl({ goal: 'Search', history: [] }))
    .resolves.toBe('https://example.com/');
});

it('requests typed decisions from the provider for both text and URL generation', async () => {
  vi.stubEnv('GEMINI_KEY', 'synthetic-test-key');
  const packets: Array<{ generationConfig: { responseJsonSchema?: unknown } }> = [];
  vi.stubGlobal('fetch', async (_input: unknown, init: RequestInit) => {
    packets.push(JSON.parse(String(init.body)));
    const value = packets.length === 1 ? { fill: true, text: 'Hanoi' } : { ok: true, url: 'https://example.com' };
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] }, finishReason: 'STOP' }] });
  });
  const writer = createWriter();
  await writer.generateText({ goal: 'Search', history: [], observation });
  await writer.generateUrl({ goal: 'Search', history: [] });
  for (const [index, decision, payload] of [[0, 'fill', 'text'], [1, 'ok', 'url']] as const) {
    expect(packets[index].generationConfig.responseJsonSchema).toMatchObject({
      type: 'object', properties: { [decision]: { type: 'boolean' }, [payload]: { type: 'string' } },
      required: [decision, payload], additionalProperties: false,
    });
  }
});
