// Controlled websites for reproducible end-to-end browsing. Flight prices here
// are synthetic and MUST NOT be presented as real travel offers.
export const flightPrompt = 'find me a flight from hanoi to vancouver in december for less than 2,500$';
const wrap = body => `<!doctype html><html><head><meta charset="utf-8"><title>Browser journey fixture</title></head><body><main>${body}</main></body></html>`;
const escapeHtml = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function fixtureResponse(url, method='GET', body='') {
  const id=url.pathname.split('/')[2];
  const q=url.searchParams;
  if(url.pathname==='/redirect') return {status:302,headers:{location:'/result/redirect'},body:''};
  if(url.pathname==='/slow-image') return {status:200,headers:{'content-type':'image/svg+xml'},delay:1800,body:'<svg xmlns="http://www.w3.org/2000/svg"/>'};
  if(url.pathname==='/result/redirect') return {body:wrap('<h1>Journey complete: redirect</h1><img src="/slow-image">')};
  if(url.pathname==='/result/post') return {body:wrap(method==='POST' && new URLSearchParams(body).get('token')==='popup-proof'
    ? '<h1>Journey complete: POST popup</h1><script>sessionStorage.setItem("proof","preserved")</script>' : '<h1>Wrong method or lost POST state</h1>')};
  if(url.pathname==='/result/delayed') return {body:wrap('<h1>Journey complete: delayed popup</h1>')};
  if(url.pathname==='/result/search') return {body:wrap(q.get('q')==='architecture smoke'?'<h1>Journey complete: exact search</h1>':'<h1>Wrong search query</h1>')};
  if(url.pathname==='/result/flight') {
    const ok=/hanoi|HAN/i.test(q.get('from')||'') && /vancouver|YVR/i.test(q.get('to')||'') && /2026-12|december/i.test(q.get('month')||'') && Number((q.get('budget')||'').replace(/[^\d.]/g,''))===2500;
    return {body:wrap(ok?'<h1>Journey complete: synthetic flight</h1><p>TEST DATA — NOT A REAL FARE.</p><p>Hanoi HAN to Vancouver YVR | December 8, 2026 | CAD 1,850 | one-way economy, one adult.</p>':'<h1>Flight criteria do not match</h1>')};
  }
  const pages={
    search:'<h1>Search</h1><form action="/result/search"><label>Search query<input name="q" aria-label="Search query"></label><button>Search</button></form>',
    menu:'<h1>Menu navigation</h1><button onclick="document.querySelector(\'nav\').hidden=false">Open menu</button><nav hidden><button onclick="document.querySelector(\'main\').innerHTML=\'<h1>Journey complete: menu</h1>\'">View details</button></nav>',
    spa:'<h1>Options</h1><button onclick="this.disabled=true;document.querySelector(\'p\').textContent=\'Loading options\';setTimeout(()=>document.querySelector(\'main\').innerHTML=\'<h1>Journey complete: async results</h1>\',350)">Load options</button><p>No results loaded</p>',
    redirect:'<h1>Redirect navigation</h1><a href="/redirect">Open destination</a>',
    post:'<h1>Open POST result</h1><form action="/result/post" method="post" target="_blank"><input type="hidden" name="token" value="popup-proof"><button>Continue</button></form>',
    delayed:'<h1>Delayed result</h1><button onclick="this.disabled=true;setTimeout(()=>window.open(\'/result/delayed\'),300)">Open delayed result</button>',
    scroll:'<h1>Scroll down for the finish button</h1><div style="height:1400px"></div><button onclick="this.outerHTML=\'<h1>Journey complete: scrolling</h1>\'">Finish journey</button>',
    rerender:'<h1>Update first, then Continue</h1><button onclick="document.querySelector(\'#next\').outerHTML=\'<button id=next onclick=finish()>Continue updated step</button>\';this.remove()">Update controls</button><button id="next" disabled>Continue unavailable</button><script>function finish(){document.querySelector("main").innerHTML="<h1>Journey complete: rerender</h1>"}</script>',
    isolation:`<h1>Session ${escapeHtml(q.get('side')||'unknown')}</h1><button onclick="document.querySelector('main').innerHTML='<h1>Journey complete: ${escapeHtml(q.get('side')||'unknown')} session</h1>'">Finish ${escapeHtml(q.get('side')||'unknown')} session</button>`,
    flight:'<h1>Synthetic flight search — test data only</h1><form action="/result/flight"><label>Origin<input aria-label="Origin" name="from"></label><label>Destination<input aria-label="Destination" name="to"></label><label>Departure month (YYYY-MM)<input aria-label="Departure month YYYY-MM" name="month"></label><label>Maximum budget in CAD<input aria-label="Maximum budget in CAD" name="budget"></label><button>Find matching flights</button></form>',
  };
  return pages[id]?{body:wrap(pages[id])}:{status:404,body:wrap('<h1>Fixture not found</h1>')};
}
export function journeys(base) {
  return [
    {id:'01-search',path:'search',goal:'Search for the exact words architecture smoke and submit the search.',proof:'Journey complete: exact search',steps:[['fill','Search query','architecture smoke'],['click','button "Search"']]},
    {id:'02-menu',path:'menu',goal:'Open the menu and view details.',proof:'Journey complete: menu',steps:[['click','Open menu'],['click','View details']]},
    {id:'03-spa',path:'spa',goal:'Load options and wait until the async results have completed.',proof:'Journey complete: async results',steps:[['click','Load options']]},
    {id:'04-redirect',path:'redirect',goal:'Open the destination and verify the redirect completed.',proof:'Journey complete: redirect',steps:[['click','Open destination']]},
    {id:'05-post-popup',path:'post',goal:'Continue to the POST result in the new tab and verify the result.',proof:'Journey complete: POST popup',steps:[['click','Continue']]},
    {id:'06-delayed-popup',path:'delayed',goal:'Open the delayed result once and wait for its new tab.',proof:'Journey complete: delayed popup',steps:[['click','Open delayed result']]},
    {id:'07-scroll',path:'scroll',goal:'Scroll down and press Finish journey.',proof:'Journey complete: scrolling',steps:[['scroll'],['scroll'],['click','Finish journey']]},
    {id:'08-rerender',path:'rerender',goal:'Update the controls first, then activate Continue updated step.',proof:'Journey complete: rerender',steps:[['click','Update controls'],['click','Continue updated step']]},
    {id:'09-isolation',path:'isolation?side=left',goal:'Finish the left session.',proof:'Journey complete: left session',steps:[['click','Finish left session']],parallel:true},
    {id:'10-flight-fixture',path:'flight',goal:`${flightPrompt}. This is a synthetic test portal, not real fares. Use Hanoi (HAN), Vancouver (YVR), departure month 2026-12, budget 2500 CAD, one-way economy for one adult. Submit the search only; do not book.`,proof:'Journey complete: synthetic flight',steps:[['fill','Origin','Hanoi'],['fill','Destination','Vancouver'],['fill','Departure month','2026-12'],['fill','Maximum budget','2500'],['click','Find matching flights']]},
  ].map(c=>({...c,url:`${base}/case/${c.path}`}));
}
export async function exercise(boundary, runId, scenario) {
  await boundary.begin(runId);
  await boundary.open(runId,scenario.url);
  for(const [kind,label,value] of scenario.steps) {
    let o=await boundary.observe(runId);
    if(kind==='scroll') {
      await boundary.act(runId,{kind:'scroll_down',observationId:o.id},o);
      await new Promise(r=>setTimeout(r,100)); continue;
    }
    const item=o.candidates.find(c=>c.label.includes(label));
    if(!item) throw new Error(`Missing candidate for ${scenario.id}: ${label}`);
    await boundary.act(runId,{kind:'click_item',target:item.ref,observationId:o.id},o);
    if(kind==='fill') {
      o=await boundary.observe(runId);
      await boundary.act(runId,{kind:'type_text',value,observationId:o.id},o);
    }
  }
  const deadline=performance.now()+8000;
  let result;
  while(performance.now()<deadline) {
    result=await boundary.observe(runId);
    if(result.pageContext?.includes(scenario.proof)||result.snapshot.includes(scenario.proof)) return result;
    await new Promise(r=>setTimeout(r,150));
  }
  throw new Error(`Missing visible completion evidence for ${scenario.id}`);
}
