import { db } from "@/lib/db";
import { forbidden, withUser } from "@/lib/api";
import { canApprovePlan } from "@/lib/plans";
import { rejectInput } from "@/lib/schemas";
import { loadPlanForUser } from "@/lib/serialize";

/** Rejection returns the plan to its author for correction and resubmission. */
export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  const plan = await loadPlanForUser(user, params.id);
  if (!canApprovePlan(user, plan)) throw forbidden("Bu rejani rad eta olmaysiz");
  const { comment } = rejectInput.parse(await req.json());

  await db.$transaction([
    db.planApproval.create({
      data: { planId: plan.id, version: plan.version, action: "REJECT", comment, userId: user.id },
    }),
    db.plan.update({ where: { id: plan.id }, data: { status: "REJECTED", rejectionReason: comment } }),
  ]);
  return { ok: true };
});
