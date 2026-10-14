import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { analyzePlan, type AnalysisDocument, type AnalysisInput } from "./ai";
import { DOCUMENT_TYPE_LABELS } from "./labels";
import { readFile } from "./storage";

/** File types Gemini reads directly; Word and other formats are listed by name only. */
const READABLE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"]);
/** Inline request data stays well under Gemini's 20 MB request limit. */
const DOCUMENT_BUDGET_BYTES = 14 * 1024 * 1024;

/**
 * Off unless AI_READ_DOCUMENTS=true: on Gemini's free tier the provider may use what it is sent,
 * so agreement files stay private by default and the AI judges the entered agreement data only.
 */
const readDocuments = () => process.env.AI_READ_DOCUMENTS === "true";

type FileRef = { id: string; fileName: string; mimeType: string; size: number; url: string };

/** Loads the readable attachments within budget; returns the files sent and the ids of those read. */
async function loadDocuments(agreements: { title: string; attachments: FileRef[] }[]) {
  const documents: AnalysisDocument[] = [];
  const read = new Set<string>();
  if (!readDocuments()) return { documents, read };
  let budget = DOCUMENT_BUDGET_BYTES;
  for (const agreement of agreements) {
    for (const file of agreement.attachments) {
      if (!READABLE_TYPES.has(file.mimeType) || file.size > budget) continue;
      const stream = await readFile(file.url).catch(() => null);
      if (!stream) continue;
      const data = Buffer.from(await new Response(stream).arrayBuffer());
      budget -= data.length;
      documents.push({ agreement: agreement.title, fileName: file.fileName, mimeType: file.mimeType, data });
      read.add(file.id);
    }
  }
  return { documents, read };
}

/** Compares the approved roadmap with the entered results and stores the AI verdict. */
export async function runPlanAnalysis(planId: string, userId: string) {
  const plan = await db.plan.findUniqueOrThrow({
    where: { id: planId },
    include: {
      items: { orderBy: { order: "asc" } },
      agreements: { orderBy: { createdAt: "asc" }, include: { attachments: { orderBy: { createdAt: "asc" } } } },
    },
  });

  const { documents, read } = await loadDocuments(plan.agreements);

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
          documentNumber: a.documentNumber,
          signedDate: a.signedDate?.toISOString().slice(0, 10) ?? null,
          amount: a.amount ? `${a.amount.toString()} ${a.currency ?? ""}`.trim() : null,
          ...(readDocuments() && { files: a.attachments.map((f) => ({ name: f.fileName, read: read.has(f.id) })) }),
        })),
    })),
    extraAgreements: plan.agreements
      .filter((a) => !a.planItemId)
      .map((a) => ({ title: a.title, partner: a.partner, documentType: DOCUMENT_TYPE_LABELS[a.documentType] })),
  };

  const result = await analyzePlan(input, documents);
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
