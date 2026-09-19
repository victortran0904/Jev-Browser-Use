import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { createBrowserBoundary, type CommandRunner } from "../../server/browser.js";

/** An external relay substitute executing the exact boundary scripts in real Chromium.
 * No page.evaluate/locator calls are mocked. The live CI suite separately exercises the real relay. */
export async function browserFixture(html: string) {
  const browser: Browser = await chromium.launch({ executablePath: chromium.executablePath(), headless: true, args: ["--no-sandbox"] });
  const sessions = new Map<string, { page: Page; context: BrowserContext; state: Record<string, unknown> }>();
  const runner: CommandRunner = async args => {
    if (args[0] === "session" && args[1] === "new") {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      sessions.set(args[2], { page, context, state: {} });
      return JSON.stringify({ ok: true, session: { id: args[2] } });
    }
    if (args[0] === "session" && args[1] === "delete") {
      await sessions.get(args[2])?.context.close(); sessions.delete(args[2]);
      return JSON.stringify({ deleted: true });
    }
    if (args[0] === "status") return JSON.stringify({ targets: [], sessions: [] });
    const session = sessions.get(args[args.indexOf("--session") + 1]);
    if (!session) throw new Error("Session missing");
    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const value = await new AsyncFunction("page", "state", "context", "browser", args.at(-1))(session.page, session.state, session.context, browser);
      return JSON.stringify({ ok: true, value });
    } catch (error) { return JSON.stringify({ ok: false, error: String(error) }); }
  };
  const boundary = createBrowserBoundary(runner);
  await boundary.begin("test");
  const page = sessions.get("jev-test")!.page;
  await page.setContent(html);
  return { browser, page, boundary, runner, sessions, close: () => browser.close() };
}
