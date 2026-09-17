# Jev Browser Agent

A local browser-agent console that combines TypeSafe AI's Jev decision model with OpenCode Browser Control. Jev selects one bounded action from the current DOM/accessibility snapshot; deterministic code validates and executes it. Screenshots are shown to the user but are never sent to a model. There is no OCR and no paid chat model in the planning loop.

## Prerequisites

- Node.js 22.19 or newer
- A Chromium-family browser (Chrome, Brave, Edge, Arc, or Chromium)
- A TypeSafe API key
- The Browser Control extension loaded in that browser

## Setup

```bash
npm install
cp .env.example .env
```

Put your existing key in `.env` as `TYPESAFE_API_KEY`. Add `GEMINI_API_KEY` or the compatibility alias `GEMINI_KEY`; Gemini writes unknown HTTPS URLs and free text only after Jev selects `open_site` or `type_text`. `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`. Screenshots are never sent to either model. The `.env` file is ignored by Git and keys are read only by the backend.

Print the bundled extension path:

```bash
npm run browser:extension-path
```

Open your browser's extensions page, enable Developer mode, choose **Load unpacked**, and select that directory. Pin and enable Browser Control, then verify the connection:

```bash
npm run browser:doctor
```

## Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), enter a plain-English goal, and run it. Each run starts on a neutral page; Jev can select `open_site`, Gemini supplies a validated URL when the site is not in the small catalog, and the loop observes the resulting DOM again. The API listens on `127.0.0.1:8787`; Vite proxies `/api` during development.

For a production-style local run:

```bash
npm run build
npm start
```

Open [http://localhost:8787](http://localhost:8787).

## Safety model

- The browser exposes at most 180 currently visible interactive DOM elements to Jev; there is no OCR.
- Actions are limited to open site, click item, type text, Enter/Escape, scroll, back, wait, done, or none.
- Jev only classifies bounded choices. Gemini may generate one validated HTTPS URL or the text for an already-focused browser field.
- Action refs are bound to the current observation so stale actions fail closed.
- Concrete action results feed the next decision. Runs stop on `done`, `none`, low confidence, two repeated/no-op actions, 12 steps, or immediately via **Stop**.
- Page text is treated as untrusted state, never as instructions.

## Commands

```bash
npm test
npm run typecheck
npm run build
npm run browser:doctor
npm run browser:extension-path
```

Run state is memory-only. Latest per-run screenshots live under `.runs/` and are ignored by Git. This app is intentionally local-only and has no deployment configuration.
