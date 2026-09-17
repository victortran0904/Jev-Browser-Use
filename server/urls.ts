export function extractExplicitUrl(text: string): string | null {
  if (!text) return null;

  // 1. Explicit http:// or https:// URLs
  const httpMatch = text.match(/https?:\/\/[^\s<>"']+/i);
  if (httpMatch) {
    const raw = httpMatch[0].replace(/[.,;:!?)]+$/, "");
    try {
      const parsed = new URL(raw);
      parsed.protocol = "https:";
      return parsed.toString();
    } catch {
      return null;
    }
  }

  // 2. www. domains
  const wwwMatch = text.match(/(?:^|\s)(www\.[^\s<>"']+)/i);
  if (wwwMatch) {
    const raw = wwwMatch[1].replace(/[.,;:!?)]+$/, "");
    try {
      const parsed = new URL(`https://${raw}`);
      return parsed.toString();
    } catch {
      return null;
    }
  }

  return null;
}
