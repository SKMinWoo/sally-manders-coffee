// The writer: Gemini's free tier, called over plain HTTPS so the shop takes on no SDK. The key is
// GEMINI_API_KEY and travels in a header, never the URL, so it can't land in a log line. Every
// failure comes back as a reason in words, never a throw: a brief that can't be written by the
// model is written from the template, and the day goes on.

import { z } from "zod";

// the lite model: timed 2026-11-15 on the free tier, it wrote a brief in about a second, while
// gemini-flash-latest (a thinking model) hadn't answered after 90 s and was often "busy" (503)
export const DEFAULT_MODEL = "gemini-flash-lite-latest";
const MODEL_NAME = /^[a-z0-9][a-z0-9.-]{0,63}$/; // it goes into the URL's path, so nothing else gets in

export type ModelConfig = {
  key: string;
  model?: string | undefined;
  /** the network, swapped out in the tests */
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export type Draft = { ok: true; text: string; model: string } | { ok: false; reason: string; model: string };

const Reply = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })) }).optional(),
        finishReason: z.string().optional(),
      }),
    )
    .min(1),
});

export async function askModel(system: string, prompt: string, cfg: ModelConfig): Promise<Draft> {
  const model = cfg.model || DEFAULT_MODEL;
  if (!MODEL_NAME.test(model)) return { ok: false, reason: "GEMINI_MODEL isn't a model name", model: "invalid" };
  const fail = (reason: string): Draft => ({ ok: false, reason, model });

  let res: Response;
  try {
    res = await (cfg.fetch ?? fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": cfg.key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
      signal: AbortSignal.timeout(cfg.timeoutMs ?? 25_000),
    });
  } catch {
    return fail("the model didn't answer in time");
  }
  // the free tier says no with a 429 once the day's quota is spent, and a 503 when it's busy
  if (res.status === 429) return fail("the model's free quota was spent");
  if (res.status === 503) return fail("the model was too busy to answer");
  if (!res.ok) return fail(`the model refused the request (HTTP ${res.status})`);

  const parsed = Reply.safeParse(await res.json().catch(() => null));
  if (!parsed.success) return fail("the model's reply wasn't one it could read");
  const c = parsed.data.candidates[0]!;
  // a thinking model sends its reasoning as parts marked thought; only the answer is the draft
  const text = (c.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim();
  if (!text) return fail(`the model sent no text${c.finishReason ? ` (${c.finishReason.toLowerCase()})` : ""}`);
  return { ok: true, text, model };
}
