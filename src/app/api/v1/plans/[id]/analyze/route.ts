import { forbidden, requirePermission, withUser } from "@/lib/api";
import { runPlanAnalysis } from "@/lib/analysis";
import { loadPlanForUser } from "@/lib/serialize";
import { audit } from "@/lib/audit";

export const maxDuration = 120;

export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  requirePermission(user, "ai:analyze");
  const plan = await loadPlanForUser(user, params.id);
  if (plan.status !== "REPORTED" && plan.status !== "COMPLETED") {
    throw forbidden("AI tahlil hisobot kiritilgandan keyin ishlaydi");
  }
  const analysis = await runPlanAnalysis(plan.id, user.id);
  await audit(user, { action: "plan.analyze", entityType: "plan", entityId: plan.id, summary: `«${plan.title}» AI tahlili: ${analysis.score}%` }, req);
  return { ok: true, score: analysis.score };
});
