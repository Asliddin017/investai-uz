import { ApiError, GoogleGenAI } from "@google/genai";
import * as z from "zod/v4";

/**
 * Gemini models tried in order; the free tier often answers 503 "high demand", so a busy
 * model hands over to the next one. Override with GEMINI_MODEL (comma-separated).
 */
export const AI_MODELS = (process.env.GEMINI_MODEL || "gemini-3.8-flash,gemini-3.6-flash,gemini-2.5-flash")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

/** Overloaded, rate-limited or briefly failing: worth retrying or trying another model. */
const TRANSIENT = [429, 500, 502, 503, 504];
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
Xorijiy safardagi har bir rejaning kutilgan natijasini safardan keyin kiritilgan haqiqiy natija va
tuzilgan kelishuvlar (shartnoma, memorandum, bitim) bilan solishtirasiz.

Baholash qoidalari:
- Har bir reja uchun 0–100 oralig'ida moslik balli bering: kutilgan natijaga to'liq erishilgan va hujjat bilan
  tasdiqlangan bo'lsa 90–100; erishilgan, lekin hujjat yo'q yoki natija kutilgandan kichik bo'lsa 50–85;
  erishilmagan bo'lsa 0–20 (sababi asosli bo'lsa ham ball past qoladi).
- Umumiy ball (score) — rejalar ballarining o'rtachasi, butun songa yaxlitlangan.
- Rejadan tashqari kelishuvlar umumiy ballga qo'shilmaydi; ularni extraAchievements maydonida alohida yozing.
- Xulosa (summary) 2–4 jumladan iborat bo'lsin, rahbar o'qiydi: aniq raqamlar, ortiqcha so'zsiz.
- Tavsiyalar (recommendations) — erishilmagan rejalar bo'yicha keyingi aniq qadamlar, 0–4 ta.
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
    summary: `${input.items.length} ta rejadan ${achieved} tasiga erishildi, ${failed} tasiga erishilmadi. Rejalar va natijalar mosligi ${score}%.`,
    items,
    extraAchievements: input.extraAgreements.length
      ? `Rejadan tashqari ${input.extraAgreements.length} ta kelishuv tuzildi: ${input.extraAgreements.map((a) => `${a.title} (${a.partner})`).join("; ")}.`
      : "Rejadan tashqari kelishuv yo'q.",
    recommendations: input.items
      .filter((i) => i.result === "NOT_ACHIEVED")
      .slice(0, 4)
      .map((i) => `"${i.title}" rejasi bo'yicha qayta muzokara o'tkazing.`),
    model: FALLBACK_MODEL,
  };
}

/** JSON Schema for Gemini's structured output; `$schema` is not among the keywords it accepts. */
function responseSchema() {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(AnalysisSchema) as Record<string, unknown>;
  return schema;
}

export async function analyzePlan(input: AnalysisInput): Promise<AnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return heuristicAnalysis(input);

  const ai = new GoogleGenAI({ apiKey });
  const startedAt = Date.now();
  for (const model of AI_MODELS) {
    // Leave room for the heuristic and the database work inside the route's 120 s limit.
    if (Date.now() - startedAt > 60_000) break;
    try {
      const response = await ai.models.generateContent({
        model,
        contents: `Quyidagi safar rejalari va natijalarini tahlil qiling:

${JSON.stringify(input, null, 2)}`,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: responseSchema(),
          // One quick retry per model; a model that stays busy hands over to the next.
          httpOptions: {
            timeout: 25_000,
            retryOptions: { attempts: 2, initialDelay: 2, maxDelay: 4, httpStatusCodes: TRANSIENT },
          },
        },
      });
      const parsed = AnalysisSchema.safeParse(JSON.parse(response.text ?? ""));
      if (!parsed.success) {
        console.error(`AI tahlil (${model}): javob sxemaga mos emas`, parsed.error.issues[0]);
        continue;
      }
      return { ...parsed.data, score: Math.max(0, Math.min(100, Math.round(parsed.data.score))), model };
    } catch (err) {
      if (err instanceof ApiError) {
        console.error(`AI tahlil xatosi (${model}, ${err.status}):`, err.message);
        // A bad key or request fails the same way on every model.
        if (!TRANSIENT.includes(err.status)) break;
      } else {
        console.error(`AI tahlil xatosi (${model}):`, err);
      }
    }
  }
  return heuristicAnalysis(input);
}
