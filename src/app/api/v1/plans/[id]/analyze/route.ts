import { forbidden, requirePermission, withUser } from "@/lib/api";
import { runPlanAnalysis } from "@/lib/analysis";
import { loadPlanForUser } from "@/lib/serialize";

export const maxDuration = 120;

export const POST = withUser<{ id: string }>(async ({ user, params }) => {
  requirePermission(user, "ai:analyze");
  const plan = await loadPlanForUser(user, params.id);
  if (plan.status !== "REPORTED" && plan.status !== "COMPLETED") {
    throw forbidden("AI tahlil hisobot kiritilgandan keyin ishlaydi");
  }
  const analysis = await runPlanAnalysis(plan.id, user.id);
  return { ok: true, score: analysis.score };
});
