/** Runs entirely inside the page. Keep this function self-contained for serialization. */
export function collectObservation() {
  const started = performance.now();
  let elementsInspected = 0;
  let accepted = 0;

            const isSensitive = (el: Element) => {
              const metadata = ["type", "autocomplete", "name", "id", "aria-label"].map(name => el.getAttribute(name) || "").join(" ").toLowerCase();
              return /password|passcode|one-time-code|cc-|credit.?card|card.?number|security.?code|\bcvv\b|\bcvc\b|\botp\b/.test(metadata);
            };
            const host = window as unknown as { __jevRefs?: { ids: WeakMap<Element, string>; next: number; nodes: Map<string, HTMLElement>; documentId: string } };
            const registry = host.__jevRefs ?? (host.__jevRefs = { ids: new WeakMap(), next: 0, nodes: new Map(), documentId: Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-") });
            const selector = "a,button,input,textarea,select,[role=button],[role=link],[role=textbox],[role=searchbox],[contenteditable=true]";
            const elements = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((el) => {
              if (accepted >= 180 || !(el instanceof HTMLElement)) return false;
              elementsInspected++;
              const rect = el.getBoundingClientRect();
              const style = getComputedStyle(el);
              if (el.tagName.toLowerCase() === "a" && (el.getAttribute("href") || "").startsWith("#")) return false;
              const name = el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("title") || el.getAttribute("alt") || (el instanceof HTMLInputElement && !isSensitive(el) ? el.value : "") || el.innerText || el.textContent || "";
              const visible = Boolean(String(name).trim()) && rect.width > 0 && rect.height > 0 && rect.right >= 0 && rect.left <= innerWidth && rect.bottom >= 0 && rect.top <= innerHeight && style.visibility !== "hidden" && style.display !== "none";
              if (visible) accepted++;
              return visible;
            }).slice(0, 180);
            registry.nodes = new Map();
            const candidates = elements.map((el, index) => {
              let ref = registry.ids.get(el);
              if (!ref) { ref = "e" + (++registry.next); registry.ids.set(el, ref); }
              registry.nodes.set(ref, el);
              const tag = el.tagName.toLowerCase();
              const type = (el.getAttribute("type") || "").toLowerCase();
              const role = el.getAttribute("role") || (tag === "a" ? "link" : tag === "button" ? "button" : tag === "select" ? "combobox" : tag === "textarea" ? "textbox" : tag === "input" ? (type === "search" ? "searchbox" : type === "submit" ? "button" : "textbox") : el.isContentEditable ? "textbox" : tag);
              const name = el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("title") || el.getAttribute("alt") || (el instanceof HTMLInputElement && !isSensitive(el) ? el.value : "") || el.innerText || el.textContent || "";
              return { ref, label: (role + " " + JSON.stringify(String(name).replace(/\s+/g, " ").trim().slice(0, 220))).trim() };
            });
            const el = document.activeElement;
            let focusedField = null;
            if (el && el instanceof HTMLElement && el !== document.body) {
              const tag = el.tagName.toLowerCase();
              const role = el.getAttribute("role") || "";
              const isText = !isSensitive(el) && (tag === "textarea" || (tag === "input" && !["button", "submit", "checkbox", "radio", "file", "hidden"].includes((el.getAttribute("type") || "text").toLowerCase())) || role === "textbox" || role === "searchbox" || el.isContentEditable);
              focusedField = { label: el.getAttribute("aria-label") || el.getAttribute("name") || el.getAttribute("id") || "", placeholder: el.getAttribute("placeholder") || "", value: isSensitive(el) ? "" : "value" in el ? String((el as HTMLInputElement).value || "").slice(0, 300) : String(el.textContent || "").slice(0, 300), isText };
            }
            return { documentId: registry.documentId, metrics: { elementsInspected, domExtractMs: performance.now() - started }, candidates, focusedField, pageText: String(document.body?.innerText || "").replace(/\n{3,}/g, "\n\n").slice(0, 12000) };
}

// tsx may emit a harmless __name helper; supply it inside the page, not from Node.
export const collectorSource = `(() => { const __name = (fn, _name) => fn; return (${collectObservation.toString()})(); })()`;
