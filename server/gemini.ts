export const geminiModel = () => process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
export const geminiFallbackModel = () => process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite";

export function isTemporaryGeminiError(error: unknown): boolean {
  const detail = (() => {
    try { return `${String(error)} ${JSON.stringify(error)}`; }
    catch { return String(error); }
  })();

  return /\b503\b|UNAVAILABLE|high demand|temporar(?:y|ily) unavailable|overload/i.test(detail);
}

export async function withGeminiFallback<T>(generate: (model: string) => Promise<T>): Promise<T> {
  const primary = geminiModel();
  try {
    return await generate(primary);
  } catch (error) {
    const fallback = geminiFallbackModel();
    if (!isTemporaryGeminiError(error) || fallback === primary) throw error;
    return generate(fallback);
  }
}
