import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { analyzePlan, type AnalysisInput } from "./ai";
import { DOCUMENT_TYPE_LABELS } from "./labels";

/** Compares the approved roadmap with the entered results and stores the AI verdict. */
export async function runPlanAnalysis(planId: string, userId: string) {
  const plan = await db.plan.findUniqueOrThrow({
    where: { id: planId },
    include: { items: { orderBy: { order: "asc" } }, agreements: true },
  });

  const input: AnalysisInput = {
    title: plan.title,
    goal: plan.goal,
    country: plan.country,
    items: plan.items.map((item) => ({
      order: item.order,
      title: item.title,
      expectedResult: item.expectedResult,
      result: item.result,
      resultNote: item.resultNote,
      failureReason: item.failureReason,
      agreements: plan.agreements
        .filter((a) => a.planItemId === item.id)
        .map((a) => ({
          title: a.title,
          partner: a.partner,
          documentType: DOCUMENT_TYPE_LABELS[a.documentType],
          deadline: a.deadline.toISOString().slice(0, 10),
        })),
    })),
    extraAgreements: plan.agreements
      .filter((a) => !a.planItemId)
      .map((a) => ({ title: a.title, partner: a.partner, documentType: DOCUMENT_TYPE_LABELS[a.documentType] })),
  };

  const result = await analyzePlan(input);
  return db.aiAnalysis.create({
    data: {
      planId,
      score: result.score,
      summary: result.summary,
      details: {
        items: result.items,
        extraAchievements: result.extraAchievements,
        recommendations: result.recommendations,
      } as Prisma.InputJsonValue,
      model: result.model,
      createdById: userId,
    },
  });
}
