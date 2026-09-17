// Document-scoped observer. Identity metadata stays in a private closure.
(() => {
  const documentId = `${Date.now()}-${Math.random()}`;
  const refs = new WeakMap();
  const identities = new WeakMap();
  const entries = new Map();
  let nextVersion = 1, nextRef = 1;
  let cached = null, dirty = true, lastFull = 0;
  const invalidate = () => { dirty = true; };
  const mutations = new MutationObserver(invalidate);
  mutations.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  const events = ['scroll', 'resize', 'load', 'transitionrun', 'transitionend', 'animationstart', 'animationend'];
  for (const event of events) window.addEventListener(event, invalidate, true);
  document.fonts?.addEventListener('loadingdone', invalidate);
  const selector = 'a,button,input,textarea,select,[role=button],[role=link],[role=textbox],[role=searchbox],[contenteditable=true]';
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
  const sensitive = el => el instanceof HTMLElement && /password|passcode|one.?time|otp|credit|card.?number|cc-|cvv|cvc|security.?code|verification.?code/i.test(['type','autocomplete','name','id','aria-label'].map(k => el.getAttribute(k) || '').join(' '));
  const isText = el => !sensitive(el) && (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['button','submit','reset','checkbox','radio','file','hidden','image'].includes(el.type)) || el.isContentEditable || ['textbox','searchbox'].includes(el.getAttribute('role')));
  const name = el => normalize(el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('alt') || (el.labels ? Array.from(el.labels).map(l => l.textContent).join(' ') : '') || (el.matches('input,textarea,[contenteditable=true]') ? el.getAttribute('name') || el.id || 'Field' : el.innerText || el.textContent)).slice(0,220);
  const role = el => el.getAttribute('role') || ({A:'link',BUTTON:'button',SELECT:'combobox',TEXTAREA:'textbox'}[el.tagName]) || (el instanceof HTMLInputElement ? el.type === 'search' ? 'searchbox' : ['submit','button','reset'].includes(el.type) ? 'button' : 'textbox' : el.isContentEditable ? 'textbox' : el.tagName.toLowerCase());
  const identity = el => JSON.stringify([el.tagName,el.getAttribute('type'),role(el),name(el),el.getAttribute('href'),el.getAttribute('name'),el.id,el.hasAttribute('disabled'),el.getAttribute('aria-disabled')]);
  function versionFor(el) {
    const raw = identity(el);
    let item = identities.get(el);
    if (!item || item.raw !== raw) { item = {raw, token: `v${nextVersion++}`}; identities.set(el,item); }
    return item;
  }
  function refFor(el) {
    let ref = refs.get(el);
    if (!ref) { ref = `e${nextRef++}`; refs.set(el,ref); }
    return ref;
  }
  function visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.visibility !== 'collapse';
  }
  function contextForPage() {
    const seen = new WeakSet();
    const regions = [
      ...Array.from(document.querySelectorAll('dialog[open],[role=dialog],[aria-modal=true]')).slice(0,3).map(el => [el,3000]),
      ...Array.from(document.querySelectorAll('[role=status],[role=alert],[aria-live=polite],[aria-live=assertive]')).slice(0,4).map(el => [el,1200]),
      [document.querySelector('main,[role=main]'),4500], [document.body,1500],
    ];
    const sections = [];
    for (const [root,budget] of regions) {
      if (!root) continue;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (node.nodeType === Node.ELEMENT_NODE) return node.matches('script,style,noscript,input,textarea,select,[contenteditable],[hidden]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let node, text = '', visited = 0;
      while ((node = walker.nextNode()) && text.length < budget && visited++ < 2500) {
        if (seen.has(node) || !node.parentElement || !visible(node.parentElement)) continue;
        seen.add(node);
        text += normalize(node.textContent.slice(0,Math.max(0,budget-text.length)*2)) + '\n';
      }
      if (text.trim()) sections.push(text.slice(0,budget));
    }
    return sections.join('\n').slice(0,12000);
  }
  function capture() {
    const started = performance.now();
    const protectedValues = Array.from(document.querySelectorAll('input,textarea,[contenteditable=true]')).filter(sensitive).map(el => String('value' in el ? el.value : el.textContent || '')).filter(v => v.length >= 3);
    const redact = text => protectedValues.reduce((value,secret) => value.split(secret).join('[redacted]'), String(text || ''));
    if (mutations.takeRecords().length) dirty = true;
    if (document.getAnimations().some(a => a.playState === 'running')) dirty = true;
    if (cached && [...entries.values()].some(e => !e.el.isConnected || identity(e.el) !== e.identity || !visible(e.el))) dirty = true;
    const full = dirty || !cached || performance.now() - lastFull > 1000;
    const candidates = full ? [] : cached.candidates;
    if (full) entries.clear();
    for (const el of full ? document.querySelectorAll(selector) : []) {
      if (!(el instanceof HTMLElement) || !visible(el)) continue;
      const label = redact(`${role(el)} ${JSON.stringify(name(el))}`);
      const ref = refFor(el), version = versionFor(el), signature = version.token;
      entries.set(ref, {el,signature,identity:version.raw});
      candidates.push({ref,label,signature,isText:isText(el),sensitive:sensitive(el)});
      if (candidates.length >= 180) break;
    }
    const el = document.activeElement;
    let focusedField = null;
    if (el instanceof HTMLElement && el !== document.body) {
      const ref = refFor(el), version = versionFor(el), signature = version.token;
      entries.set(ref, {el,signature,identity:version.raw});
      focusedField = {ref,signature,label:redact(name(el)),placeholder:redact(el.getAttribute('placeholder') || ''),value:sensitive(el) ? '' : redact(String('value' in el ? el.value : el.textContent || '').slice(0,300)),isText:isText(el)};
    }
    const publicCandidates = candidates.map(candidate => {
      const control = entries.get(candidate.ref)?.el;
      const value = control && isText(control) ? String('value' in control ? control.value : control.textContent || '').slice(0,300) : undefined;
      return {...candidate,label:redact(candidate.label + (value === undefined ? '' : ` [value=${JSON.stringify(value)}]`))};
    });
    const pageText = redact(full ? contextForPage() : cached.pageText);
    if (full) lastFull = performance.now();
    dirty = false;
    cached = {documentId,candidates,pageText};
    return {documentId,candidates:publicCandidates,focusedField,pageText,url:redact(location.href),title:redact(document.title),metrics:{domExtractMs:performance.now()-started,mode:full?'full':'focused'}};
  }
  function resolve(request) {
    if (request.documentId !== documentId) throw new Error('Stale observation: document changed');
    const entry = entries.get(request.ref);
    if (!entry || !entry.el.isConnected || entry.signature !== request.signature || identity(entry.el) !== entry.identity || !visible(entry.el)) throw new Error('Stale observation: target changed');
    if ((request.text && !isText(entry.el)) || (request.focused && document.activeElement !== entry.el)) throw new Error('Stale observation: focused field changed or sensitive');
    return entry.el;
  }
  function release() {
    mutations.disconnect();
    for (const event of events) window.removeEventListener(event,invalidate,true);
    document.fonts?.removeEventListener('loadingdone',invalidate);
    entries.clear(); cached = null;
  }
  function assertDocument(expected) { if (expected !== documentId) throw new Error('Stale observation: document changed'); }
  return {capture,resolve,release,assertDocument};
})()
