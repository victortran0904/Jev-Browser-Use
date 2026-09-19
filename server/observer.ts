import type { FocusedField } from "./types.js";
/** Document-scoped collector retained by the browser relay across observations. */
export function createObserver(documentId: string) {
    const identities = new WeakMap<HTMLElement, string>();
    let nextRef = 0;
    let observedFocus: Element | null = null;
    let observedFocusValue = "";
    let observedFocusSignature = "";
    const isSensitive = (el: Element) => (el.getAttribute("type") || "").toLowerCase() === "password"
        || /password|passcode|one.?time|(?:^|[ _-])otp|cc-|card.?number|credit|cvv|cvc|secret|token/i.test(["autocomplete", "name", "id", "aria-label", "placeholder"].map(key => el.getAttribute(key) || "").join(" "));
    const fieldValue = (el: Element) => "value" in el ? String((el as HTMLInputElement).value || "") : el.textContent || "";
    const describeField = (el: HTMLElement, redact: (text: string) => string): FocusedField | undefined => {
        if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable))
            return undefined;
        const type = (el.getAttribute("type") || "text").toLowerCase();
        const sensitive = isSensitive(el);
        const isText = !sensitive && !el.hasAttribute("disabled") && !el.hasAttribute("readonly")
            && (el instanceof HTMLTextAreaElement || el.isContentEditable || ["text", "search", "email", "url", "tel", "number", "date", "datetime-local", "month", "week", "time"].includes(type));
        const describedBy = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean)
            .map(id => document.getElementById(id)?.textContent || "").join(" ");
        const description = redact(describedBy).replace(/\s+/g, " ").trim().slice(0, 300);
        const datePicker = ["date", "datetime-local", "month", "week", "time"].includes(type) || /\bcalendar\b|\bdate picker\b|\barrow keys?\b.*\bdate\b/i.test(description);
        return { ref: identities.get(el), type, sensitive, isText,
            preferredAction: isText ? (datePicker ? "click" : "fill") : undefined,
            label: redact(el.getAttribute("aria-label") || el.getAttribute("name") || el.id || ""),
            placeholder: redact(el.getAttribute("placeholder") || ""), value: sensitive ? "" : redact(fieldValue(el)).slice(0, 300) };
    };
    const currentElements = new Map<string, HTMLElement>();
    const signatures = new Map<string, string>();
    const formSignature = (element: HTMLElement) => {
        const form = element instanceof HTMLInputElement || element instanceof HTMLButtonElement
            || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement
            ? element.form : element.closest("form");
        return form ? [form.action, form.method, form.target, form.enctype, form.noValidate] : null;
    };
    const signature = (element: HTMLElement) => JSON.stringify([
        formSignature(element), element.tagName, ...["type", "role", "aria-label", "name", "id", "href", "target", "formaction", "formtarget", "disabled", "readonly", "aria-disabled", "onclick"].map(key => element.getAttribute(key)),
        element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value : element.textContent?.trim().slice(0, 500),
    ]);
    let cachedMatches: HTMLElement[] | undefined;
    let dirty = true;
    const invalidate = () => { dirty = true; };
    let pendingChanges: MutationRecord[] = [];
    const queueChanges = (records: MutationRecord[]) => {
        if (pendingChanges.length + records.length > 64) {
            dirty = true;
            pendingChanges = [];
        }
        else
            pendingChanges.push(...records);
    };
    const mutations = new MutationObserver(queueChanges);
    mutations.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    const invalidationEvents = ["scroll", "resize", "load", "pageshow", "hashchange", "popstate"];
    for (const event of invalidationEvents)
        window.addEventListener(event, invalidate, true);
    const activeModal = () => {
        const visible = Array.from(document.querySelectorAll<HTMLElement>('dialog:modal,[role="dialog"][aria-modal="true"]')).filter(el => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"
                && !el.closest('[hidden],[inert],[aria-hidden="true"]');
        });
        visible.reverse();
        return visible.find(el => el.contains(document.activeElement)) ?? visible[0];
    };
    const inActiveScope = (element: Element) => {
        const modal = activeModal();
        return (!modal || modal.contains(element)) && !element.closest('[inert],[aria-hidden="true"]');
    };
    function collectObservation() {
        const started = performance.now();
        const modal = activeModal();
        currentElements.clear();
        signatures.clear();
        const sensitiveValues = Array.from(document.querySelectorAll("input,textarea,[contenteditable=true]"))
            .filter(isSensitive).map(fieldValue).filter(Boolean).sort((a, b) => b.length - a.length);
        const redact = (text: string) => sensitiveValues.reduce((value, secret) => value.split(secret).join("[redacted]"), text);
        const selector = "a,button,input,textarea,select,[role=combobox],[role=option],[role=button],[role=link],[role=textbox],[role=searchbox],[contenteditable=true]";
        queueChanges(mutations.takeRecords());
        const changes = pendingChanges;
        pendingChanges = [];
        const broadChange = changes.some(change => change.type === "attributes" && ["style", "class", "hidden"].includes(change.attributeName ?? ""));
        const mode = dirty || !cachedMatches || broadChange || (changes.length > 0 && cachedMatches.length > 4096)
            ? "full" as const : changes.length ? "incremental" as const : "focused" as const;
        if (mode === "full")
            cachedMatches = Array.from(document.querySelectorAll<HTMLElement>(selector));
        else if (mode === "incremental") {
            const members = new Set(cachedMatches!.filter(element => element.isConnected));
            for (const change of changes) {
                if (change.type === "attributes" && change.target instanceof HTMLElement) {
                    if (change.target.matches(selector))
                        members.add(change.target);
                    else
                        members.delete(change.target);
                }
                for (const added of Array.from(change.addedNodes)) {
                    if (!(added instanceof HTMLElement))
                        continue;
                    if (added.matches(selector))
                        members.add(added);
                    for (const child of Array.from(added.querySelectorAll<HTMLElement>(selector)))
                        members.add(child);
                }
            }
            cachedMatches = [...members].sort((a, b) => a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
        }
        const matches = cachedMatches!;
        dirty = false;
        const candidates: Array<{
            ref: string;
            label: string;
            field?: FocusedField;
        }> = [];
        let examinedCandidates = 0;
        for (const el of matches) {
            examinedCandidates += 1;
            if (!(el instanceof HTMLElement))
                continue;
            if ((modal && !modal.contains(el)) || el.closest('[inert],[aria-hidden="true"]'))
                continue;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0 || rect.right < 0 || rect.left > innerWidth || rect.bottom < 0 || rect.top > innerHeight)
                continue;
            const tag = el.tagName.toLowerCase();
            if (tag === "a" && (el.getAttribute("href") || "").startsWith("#"))
                continue;
            const style = getComputedStyle(el);
            if (style.visibility === "hidden" || style.display === "none")
                continue;
            const childLabel = Array.from(el.children).map(child => child.getAttribute("aria-label") || "").find(Boolean) || "";
            const name = el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("title") || el.getAttribute("alt") || (el instanceof HTMLInputElement && !isSensitive(el) ? el.value : "") || childLabel || el.innerText || el.textContent || "";
            if (!name.trim())
                continue;
            const type = (el.getAttribute("type") || "").toLowerCase();
            const role = el.getAttribute("role") || (tag === "a" ? "link" : tag === "button" ? "button" : tag === "select" ? "combobox" : tag === "textarea" ? "textbox" : tag === "input" ? (type === "search" ? "searchbox" : type === "submit" ? "button" : "textbox") : el.isContentEditable ? "textbox" : tag);
            const ref = identities.get(el) ?? "e" + (++nextRef);
            identities.set(el, ref);
            currentElements.set(ref, el);
            signatures.set(ref, signature(el));
            candidates.push({ ref, field: describeField(el, redact), label: (role + " " + JSON.stringify(redact(name).replace(/\s+/g, " ").trim().slice(0, 220))).trim() });
            if (candidates.length === 180)
                break;
        }
        const el = document.activeElement;
        observedFocus = el;
        observedFocusSignature = el instanceof HTMLElement ? signature(el) : "";
        observedFocusValue = el && !isSensitive(el) ? fieldValue(el) : "";
        let focusedField = null;
        if (el instanceof HTMLElement && el !== document.body)
            focusedField = describeField(el, redact) ?? null;
        // Reserve context for dialogs/status before main content. Read bounded
        // text nodes instead of materializing the whole body's rendered text.
        const seenText = new Set<Node>();
        const readText = (root: Element, budget: number) => {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            const parts: string[] = [];
            let length = 0;
            let visited = 0;
            for (let node = walker.nextNode(); node && visited++ < 2000 && length < budget; node = walker.nextNode()) {
                const parent = node.parentElement;
                if (!parent || seenText.has(node) || parent.closest("script,style,noscript,template,input,textarea,[hidden],[aria-hidden=true]"))
                    continue;
                const style = getComputedStyle(parent);
                if (!parent.getClientRects().length || style.visibility === "hidden" || style.display === "none")
                    continue;
                // Redact before normalization or truncation can expose a credential prefix.
                const text = redact(node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, budget - length);
                if (text) {
                    seenText.add(node);
                    parts.push(text);
                    length += text.length + 1;
                }
            }
            return parts.join("\n");
        };
        const sections: string[] = modal ? ["Dialog: " + redact(modal.getAttribute("aria-label") || "").slice(0, 220)] : [];
        const priority = Array.from(document.querySelectorAll("dialog[open],[role=dialog],[role=status],[role=alert],[aria-live=polite],[aria-live=assertive]"));
        for (const root of priority.slice(0, 8))
            sections.push(readText(root, 1500));
        const main = document.querySelector("main,[role=main]") ?? document.body;
        if (main)
            sections.push(readText(main, 6000));
        if (document.body && main !== document.body)
            sections.push(readText(document.body, 2000));
        const pageText = redact(sections.filter(Boolean).join("\n\n").slice(0, 12000));
        return { documentId, url: location.href, title: redact(document.title), candidates, focusedField, pageText,
            readiness: { documentState: document.readyState, busy: Boolean(document.querySelector('[aria-busy="true"]')) },
            metrics: { domExtractMs: performance.now() - started, examinedCandidates, totalMatches: matches.length, mode } };
    }
    return {
        observe: collectObservation,
        disconnect() {
            mutations.disconnect();
            for (const event of invalidationEvents)
                window.removeEventListener(event, invalidate, true);
            cachedMatches = undefined;
            currentElements.clear();
            signatures.clear();
        },
        resolveFill(ref: string, expectedDocumentId: string) {
            const element = currentElements.get(ref);
            if (expectedDocumentId !== documentId || !element?.isConnected || !inActiveScope(element) || signatures.get(ref) !== signature(element) || isSensitive(element))
                throw new Error("Stale or sensitive text field");
            const allowed = element instanceof HTMLTextAreaElement || element.isContentEditable
                || element instanceof HTMLInputElement && ["text", "search", "email", "url", "tel", "number", "date", "datetime-local", "month", "week", "time"].includes(element.type);
            if (!allowed || element.hasAttribute("disabled") || element.hasAttribute("readonly"))
                throw new Error("Observed item is not an editable text field");
            return element;
        },
        verifyDocument(expectedDocumentId: string, expectedUrl: string) {
            if (documentId !== expectedDocumentId || location.href !== expectedUrl)
                throw new Error("Stale browser document; observe again");
            return true;
        },
        resolveFocus(expectedDocumentId: string) {
            const element = observedFocus;
            if (expectedDocumentId !== documentId || !element?.isConnected || !inActiveScope(element) || document.activeElement !== element
                || isSensitive(element) || fieldValue(element) !== observedFocusValue
                || !(element instanceof HTMLElement) || signature(element) !== observedFocusSignature)
                throw new Error("Stale or sensitive focused field; observe again");
            return element;
        },
        resolve(ref: string, expectedDocumentId: string) {
            const element = currentElements.get(ref);
            if (expectedDocumentId !== documentId || !element?.isConnected || !inActiveScope(element) || signatures.get(ref) !== signature(element))
                throw new Error("Stale browser target; observe again");
            return element;
        },
    };
}
export function observerSource(documentId: string) {
    return `(() => { const __name = (fn, _name) => fn; return (${createObserver.toString()})(${JSON.stringify(documentId)}); })()`;
}
