import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";

export const AI_MODEL = "claude-opus-5-5";
export const FALLBACK_MODEL = "heuristic";

export type AnalysisInputItem = {
  order: number;
  title: string;
  expectedResult: string;
  result: "PENDING" | "ACHIEVED" | "NOT_ACHIEVED";
  resultNote: string | null;
  failureReason: string | null;
  agreements: { title: string; partner: string; documentType: string; deadline: string }[];
};

export type AnalysisInput = {
  title: string;
  goal: string;
  country: string;
  items: AnalysisInputItem[];
  extraAgreements: { title: string; partner: string; documentType: string }[];
};

const AnalysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string(),
  items: z.array(
    z.object({
      order: z.number().int(),
      score: z.number().int().min(0).max(100),
      comment: z.string(),
    }),
  ),
  extraAchievements: z.string(),
  recommendations: z.array(z.string()),
});

export type AnalysisResult = z.infer<typeof AnalysisSchema> & { model: string };

const SYSTEM_PROMPT = `Siz viloyat hokimligi investitsiya bo'limi uchun tahlilchisiz.
Xorijiy safar rejasidagi har bir bandning kutilgan natijasini safardan keyin kiritilgan haqiqiy natija va
tuzilgan kelishuvlar (shartnoma, memorandum, bitim) bilan solishtirasiz.

Baholash qoidalari:
- Har bir band uchun 0–100 oralig'ida moslik balli bering: kutilgan natijaga to'liq erishilgan va hujjat bilan
  tasdiqlangan bo'lsa 90–100; erishilgan, lekin hujjat yo'q yoki natija kutilgandan kichik bo'lsa 50–85;
  erishilmagan bo'lsa 0–20 (sababi asosli bo'lsa ham ball past qoladi).
- Umumiy ball (score) — bandlar ballarining o'rtachasi, butun songa yaxlitlangan.
- Rejadan tashqari kelishuvlar umumiy ballga qo'shilmaydi; ularni extraAchievements maydonida alohida yozing.
- Xulosa (summary) 2–4 jumladan iborat bo'lsin, rahbar o'qiydi: aniq raqamlar, ortiqcha so'zsiz.
- Tavsiyalar (recommendations) — erishilmagan bandlar bo'yicha keyingi aniq qadamlar, 0–4 ta.
- Hamma matn o'zbek tilida (lotin yozuvida).`;

/** Plain ratio used when no API key is configured or the API call fails. */
export function heuristicAnalysis(input: AnalysisInput): AnalysisResult {
  const items = input.items.map((item) => {
    let score = 0;
    let comment = "Natija kiritilmagan.";
    if (item.result === "ACHIEVED") {
      score = item.agreements.length > 0 ? 100 : 80;
      comment =
        item.agreements.length > 0
          ? `Erishildi, ${item.agreements.length} ta hujjat bilan tasdiqlangan.`
          : "Erishildi, lekin kelishuv hujjati biriktirilmagan.";
    } else if (item.result === "NOT_ACHIEVED") {
      score = 0;
      comment = `Erishilmadi${item.failureReason ? `: ${item.failureReason}` : "."}`;
    }
    return { order: item.order, score, comment };
  });
  const score = items.length ? Math.round(items.reduce((s, i) => s + i.score, 0) / items.length) : 0;
  const achieved = input.items.filter((i) => i.result === "ACHIEVED").length;
  const failed = input.items.filter((i) => i.result === "NOT_ACHIEVED").length;
  return {
    score,
    summary: `${input.items.length} ta reja bandidan ${achieved} tasiga erishildi, ${failed} tasiga erishilmadi. Reja va natija mosligi ${score}%.`,
    items,
    extraAchievements: input.extraAgreements.length
      ? `Rejadan tashqari ${input.extraAgreements.length} ta kelishuv tuzildi: ${input.extraAgreements.map((a) => `${a.title} (${a.partner})`).join("; ")}.`
      : "Rejadan tashqari kelishuv yo'q.",
    recommendations: input.items
      .filter((i) => i.result === "NOT_ACHIEVED")
      .slice(0, 4)
      .map((i) => `"${i.title}" bandi bo'yicha qayta muzokara rejasini tuzing.`),
    model: FALLBACK_MODEL,
  };
}

export async function analyzePlan(input: AnalysisInput): Promise<AnalysisResult> {
  if (!process.env.ANTHROPIC_API_KEY) return heuristicAnalysis(input);

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(AnalysisSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Quyidagi reja va safar natijalarini tahlil qiling:\n\n${JSON.stringify(input, null, 2)}`,
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return heuristicAnalysis(input);
    }
    const parsed = response.parsed_output;
    return { ...parsed, score: Math.max(0, Math.min(100, Math.round(parsed.score))), model: response.model };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(`AI tahlil xatosi (${err.status}):`, err.message);
    } else {
      console.error("AI tahlil xatosi:", err);
    }
    return heuristicAnalysis(input);
  }
}
