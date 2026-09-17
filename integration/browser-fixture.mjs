import { chromium } from 'playwright-core';
import { createBrowserBoundary } from '../server/browser.ts';
const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;

export async function fixture(html, options = {}) {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), args:['--no-sandbox'] });
  const sessions = new Map();
  const requests = [];
  const command = async args => {
    if (args[0] === 'session' && args[1] === 'new') {
      const context = await browser.newContext({ viewport:{width:1280,height:720} });
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        requests.push({method:route.request().method(),url:url.href});
        if (url.hostname !== 'example.com') return route.abort();
        const body = typeof html === 'function' ? html(url, route.request()) : html;
        return route.fulfill({status:200,contentType:'text/html',body});
      });
      const page = await context.newPage();
      sessions.set(args[2], {page,context,state:{}});
      return JSON.stringify({ok:true});
    }
    if (args[0] === 'session' && args[1] === 'delete') {
      await sessions.get(args[2])?.context.close(); sessions.delete(args[2]);
      return JSON.stringify({ok:true});
    }
    if (args[0] === 'status') return JSON.stringify({targets:[...sessions].map(([id,s])=>({id:'target-'+id,type:'page',url:s.page.url(),owner:'relay',browserControlSessionId:id})),sessions:[]});
    const session = sessions.get(args[args.indexOf('--session')+1]);
    if (!session) throw new Error('Session missing');
    try {
      const value = await new AsyncFunction('page','context','browser','state',args.at(-1))(session.page,session.context,browser,session.state);
      return JSON.stringify({ok:true,value});
    } catch(error) { return JSON.stringify({ok:false,error:{message:error.message}}); }
  };
  const boundary = createBrowserBoundary(command, options);
  try {
    await boundary.begin('test');
    if (typeof html === 'string') await sessions.get('jev-test').page.setContent(html);
    else await boundary.open('test','https://example.com/');
  } catch (error) { await browser.close(); throw error; }
  return { boundary, browser, requests, sessions,
    get page() { return sessions.get('jev-test').state.__jevPage ?? sessions.get('jev-test').page; },
    async close() { await boundary.close('test'); await browser.close(); },
  };
}
export function candidate(observation, text) {
  const found = observation.candidates.find(c=>c.label.includes(text));
  if (!found) throw new Error('Fixture candidate missing: '+text);
  return found.ref;
}
