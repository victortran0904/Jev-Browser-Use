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

Put your existing key in `.env` as `TYPESAFE_API_KEY`. For short conversational status messages, add `GEMINI_API_KEY`; the compatibility alias `GEMINI_KEY` is also accepted. `GEMINI_MODEL` defaults to the low-latency `gemini-3.5-flash-lite`. Gemini receives only the goal, bounded action names, outcome, and final URL—never DOM text, screenshots, or fill values. The `.env` file is ignored by Git and keys are read only by the backend.

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

Open [http://localhost:5173](http://localhost:5173). Enter a plain-English goal, expand **Context** to set the initial HTTP(S) URL and exact values Jev may fill, then run it. The API listens on `127.0.0.1:8787`; Vite proxies `/api` during development.

For a production-style local run:

```bash
npm run build
npm start
```

Open [http://localhost:8787](http://localhost:8787).

## Safety model

- The browser exposes a maximum of 200 current snapshot refs to Jev.
- Actions are limited to click, exact-value fill, Enter/Escape, scroll, back, wait, done, or none.
- No generated JavaScript, coordinates, arbitrary selectors, generated text, or non-HTTP navigation are accepted.
- Fill actions can only use exact values supplied in Context.
- Action refs are bound to the current observation so stale actions fail closed.
- Runs stop on `done` or `none`, at 12 steps, or immediately via **Stop**.
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
