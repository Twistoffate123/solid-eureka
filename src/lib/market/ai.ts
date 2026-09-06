import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const cache = new Map<string, { at: number; text: string }>();

export const generateAiOutlook = createServerFn({ method: "POST" })
  .validator(
    z.object({
      symbol: z.string(),
      name: z.string(),
      headline: z.string(),
      summary: z.string(),
      bullets: z.array(z.string()),
      snapshot: z.array(z.object({ label: z.string(), value: z.string() })),
    }),
  )
  .handler(async ({ data }) => {
    const key = `${data.symbol}:${data.headline}:${data.snapshot.map((s) => s.value).join("|")}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 15 * 60_000) {
      return { ok: true as const, text: hit.text, cached: true };
    }

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI outlook is not available in this environment" };
    }

    const prompt = [
      `Write a concise trading-desk note for ${data.name} (${data.symbol}).`,
      `Technical snapshot: ${data.headline}.`,
      data.summary,
      "Key points:",
      ...data.bullets.map((b) => `- ${b}`),
      "Readings: " + data.snapshot.map((s) => `${s.label} ${s.value}`).join("; ") + ".",
      "Rules: 4-6 short sentences. Be precise. Name levels. No hype, no emojis, no bullet list, no 'as an AI'. End with one clause that this is analysis, not advice.",
    ].join("\n");

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          max_tokens: 320,
          temperature: 0.3,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        return { ok: false as const, error: `xAI API error ${res.status}` };
      }
      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = body.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) return { ok: false as const, error: "Empty model response" };
      cache.set(key, { at: Date.now(), text });
      return { ok: true as const, text, cached: false };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "AI request failed",
      };
    }
  });
