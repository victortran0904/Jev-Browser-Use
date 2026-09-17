import { GoogleGenAI } from "@google/genai";
import type { Observation } from "./types.js";
import { withGeminiFallback } from "./gemini.js";

export interface Writer {
  generateUrl(input: { goal: string; history: string[] }): Promise<string>;
  generateText(input: { goal: string; history: string[]; observation: Observation }): Promise<{ fill: boolean; text: string; reason: string }>;
}

function client() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  if (!apiKey) throw new Error("GEMINI_KEY is required for URL and text generation");
  return new GoogleGenAI({ apiKey });
}

function validUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".") && !/\s/.test(value) ? url.toString() : "";
  } catch { return ""; }
}

async function json<T>(systemInstruction: string, packet: unknown): Promise<T> {
  const gemini = client();
  const response = await withGeminiFallback((model) => gemini.models.generateContent({
    model,
    contents: JSON.stringify(packet),
    config: { maxOutputTokens: 256, temperature: 0.1, responseMimeType: "application/json", systemInstruction },
  }));
  const raw = response.text?.trim();
  if (!raw) throw new Error("Gemini returned no structured response");
  return JSON.parse(raw) as T;
}

export function createWriter(): Writer {
  return {
    async generateUrl(input) {
      const answer = await json<{ ok: boolean; url: string; reason: string }>(
        "Given a browser goal, return JSON with ok, url, reason. Choose the single best HTTPS URL to open first. Prefer the site's homepage or direct public page. Never invent credentials or private URLs.",
        { goal: input.goal, previous_actions: input.history.slice(-8) },
      );
      return answer.ok ? validUrl(answer.url.trim()) : "";
    },
    async generateText(input) {
      const answer = await json<{ fill: boolean; text: string; reason: string }>(
        "Return JSON with fill, text, reason for exactly one focused browser text field. Use the goal, field metadata, recent actions, and page text. Never invent passwords, credentials, payment data, or personal information; set fill=false for those fields.",
        {
          goal: input.goal,
          previous_actions: input.history.slice(-8),
          page: { url: input.observation.url, title: input.observation.title },
          focused_field: input.observation.focusedField,
          page_text: (input.observation.pageText ?? input.observation.snapshot).slice(0, 12_000),
        },
      );
      return { fill: Boolean(answer.fill), text: String(answer.text ?? "").trim(), reason: String(answer.reason ?? "") };
    },
  };
}

export const writer = createWriter();
