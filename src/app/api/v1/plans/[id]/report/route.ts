import { db } from "@/lib/db";
import { badRequest, forbidden, withUser } from "@/lib/api";
import { canReportPlan, completePlanIfDone } from "@/lib/plans";
import { runPlanAnalysis } from "@/lib/analysis";
import { loadPlanForUser } from "@/lib/serialize";
import { audit } from "@/lib/audit";

export const maxDuration = 120;

/** Closes the trip report: every roadmap item must have a result. Runs the AI comparison right away. */
export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  const plan = await loadPlanForUser(user, params.id);
  if (!canReportPlan(user, plan)) throw forbidden("Hisobotni yakunlay olmaysiz");
  const pending = plan.items.filter((i) => i.result === "PENDING");
  if (pending.length > 0) {
    throw badRequest(`${pending.length} ta band bo'yicha natija kiritilmagan`);
  }

  await db.$transaction([
    db.plan.update({ where: { id: plan.id }, data: { status: "REPORTED", reportedAt: new Date() } }),
    db.reportReminder.updateMany({ where: { planId: plan.id, resolvedAt: null }, data: { resolvedAt: new Date() } }),
  ]);
  const analysis = await runPlanAnalysis(plan.id, user.id);
  await completePlanIfDone(plan.id);
  await audit(user, { action: "plan.report", entityType: "plan", entityId: plan.id, summary: `«${plan.title}» hisoboti yakunlandi, AI moslik ${analysis.score}%` }, req);
  return { ok: true, score: analysis.score };
});
