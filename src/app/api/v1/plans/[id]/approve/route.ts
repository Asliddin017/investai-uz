import { db } from "@/lib/db";
import { forbidden, withUser } from "@/lib/api";
import { canApprovePlan } from "@/lib/plans";
import { loadPlanForUser } from "@/lib/serialize";
import { audit } from "@/lib/audit";

export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  const plan = await loadPlanForUser(user, params.id);
  if (!canApprovePlan(user, plan)) throw forbidden("Bu rejani tasdiqlay olmaysiz");
  const body = (await req.json().catch(() => ({}))) as { comment?: string };
  const comment = typeof body.comment === "string" && body.comment.trim() ? body.comment.trim() : null;

  await db.$transaction([
    db.planApproval.create({
      data: { planId: plan.id, version: plan.version, action: "APPROVE", comment, userId: user.id },
    }),
    db.plan.update({
      where: { id: plan.id },
      data: { status: "APPROVED", approvedAt: new Date(), approvedById: user.id },
    }),
  ]);
  await audit(user, { action: "plan.approve", entityType: "plan", entityId: plan.id, summary: `«${plan.title}» tasdiqlandi (v${plan.version})` }, req);
  return { ok: true };
});
