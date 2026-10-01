// Minimal Gemini client (REST, no SDK). Every call here receives REDACTED content only.
// Model is configurable because Google retires model IDs regularly.

const API = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta/models"; // override only for local testing
const FALLBACK_MODELS = ["gemini-flash-latest", "gemini-2.5-flash"];

function models(): string[] {
  const configured = process.env.GEMINI_MODEL?.trim();
  return Array.from(new Set([configured, ...FALLBACK_MODELS].filter(Boolean) as string[]));
}

let workingModel: string | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function geminiJson<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  temperature?: number;
}): Promise<{ data: T; model: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: opts.schema,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    },
  });

  const candidates = workingModel ? [workingModel, ...models().filter((m) => m !== workingModel)] : models();
  let lastErr = "";
  for (const model of candidates) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(`${API}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
      });
      if (res.ok) {
        const json = await res.json();
        const text: string =
          json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") ?? "";
        if (!text) {
          lastErr = `Empty response from ${model} (${json?.candidates?.[0]?.finishReason || json?.promptFeedback?.blockReason || "unknown"})`;
          break;
        }
        try {
          const data = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")) as T;
          workingModel = model;
          return { data, model };
        } catch {
          lastErr = `Could not parse JSON from ${model}`;
          continue;
        }
      }
      const errText = await res.text();
      lastErr = `${model}: ${res.status} ${errText.slice(0, 300)}`;
      if (res.status === 404 || (res.status === 400 && /not found|not supported/i.test(errText))) break; // try next model
      if (res.status === 429 || res.status >= 500) {
        const hinted = errText.match(/"retryDelay":\s*"(\d+)s"/);
        const wait = hinted ? Math.min(parseInt(hinted[1], 10), 20) * 1000 : 2000 * 2 ** attempt;
        await sleep(wait);
        continue;
      }
      throw new Error(`Gemini error - ${lastErr}`);
    }
  }
  throw new Error(`Gemini failed - ${lastErr}`);
}
