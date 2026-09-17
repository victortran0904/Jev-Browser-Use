import { GoogleGenAI } from "@google/genai";
import { withGeminiFallback } from "./gemini.js";

export interface NarratorSummary { goal: string; actions: string[]; finalUrl: string; outcome: "complete" | "error" }
export interface Narrator { acknowledge(goal: string): Promise<string>; summarize(input: NarratorSummary): Promise<string> }

const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
const clean = (text: string | undefined, fallback: string) => text?.replace(/\s+/g, " ").trim().slice(0, 240) || fallback;

async function generate(contents: string, fallback: string): Promise<string> {
  if (!apiKey) return fallback;
  try {
    const response = await withGeminiFallback((model) => new GoogleGenAI({ apiKey }).models.generateContent({
      model,
      contents,
      config: { maxOutputTokens: 60, temperature: 0.2, systemInstruction: "Write one short, plain-language sentence for a local browser agent chat. Do not invent actions or results." },
    }));
    return clean(response.text, fallback);
  } catch {
    return fallback;
  }
}

export const narrator: Narrator = {
  acknowledge: (goal) => generate(`Acknowledge that the browser agent is starting this goal: ${JSON.stringify(goal)}`, "I’ll start working on that now."),
  summarize: (input) => generate(`Summarize this browser run in one sentence. Goal: ${JSON.stringify(input.goal)}. Outcome: ${input.outcome}. Final URL: ${JSON.stringify(input.finalUrl)}. Bounded actions: ${JSON.stringify(input.actions.slice(-12))}`, input.outcome === "complete" ? "The browser run is complete." : "The browser run ended with an error."),
};
