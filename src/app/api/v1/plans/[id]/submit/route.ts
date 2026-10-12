import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, forbidden, withUser } from "@/lib/api";
import { canEditPlan, snapshotPlan } from "@/lib/plans";
import { loadPlanForUser } from "@/lib/serialize";
import { audit } from "@/lib/audit";

/** Sends a draft (or a corrected rejected plan) for approval and freezes this version in history. */
export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  const plan = await loadPlanForUser(user, params.id);
  if (!canEditPlan(user, plan)) throw forbidden("Bu rejani tasdiqqa yuborib bo'lmaydi");
  if (plan.items.length === 0) throw badRequest("Yo'l xaritasida kamida bitta band bo'lsin");

  const version = plan.version + 1;
  await db.$transaction([
    db.planVersion.create({
      data: {
        planId: plan.id,
        version,
        snapshot: snapshotPlan(plan) as unknown as Prisma.InputJsonValue,
        createdById: user.id,
      },
    }),
    db.planApproval.create({ data: { planId: plan.id, version, action: "SUBMIT", userId: user.id } }),
    db.plan.update({
      where: { id: plan.id },
      data: { status: "PENDING", version, submittedAt: new Date(), rejectionReason: null },
    }),
  ]);
  await audit(user, { action: "plan.submit", entityType: "plan", entityId: plan.id, summary: `«${plan.title}» tasdiqqa yuborildi (v${version})` }, req);
  return { ok: true };
});
