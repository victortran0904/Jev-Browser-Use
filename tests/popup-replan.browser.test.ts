import { describe, expect, it } from 'vitest';
import { browserFixture } from './helpers/browser-fixture.js';

describe('popup transition while a decision is pending', { timeout: 15000 }, () => {
  it('reports a pre-dispatch stale observation rather than clicking the old target in a new popup', async () => {
    const f = await browserFixture('<button onclick="document.body.dataset.clicked = true">Open details</button>');
    try {
      const observation = await f.boundary.observe('test');
      const popupReady = f.page.waitForEvent('popup');
      await f.page.evaluate(() => { window.open('about:blank'); });
      const popup = await popupReady;
      await popup.setContent('<main>New destination</main>');
      await expect(f.boundary.act('test', {
        kind: 'click_item', target: observation.candidates[0].ref, observationId: observation.id,
      }, observation)).rejects.toMatchObject({ name: 'StaleObservationError', dispatched: false });
      expect(await f.page.locator('body').getAttribute('data-clicked')).toBeNull();
    } finally { await f.close(); }
  });
});
