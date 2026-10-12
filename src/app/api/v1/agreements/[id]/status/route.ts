import { db } from "@/lib/db";
import { forbidden, withUser } from "@/lib/api";
import { loadAgreementForUser, serializeAgreement } from "@/lib/agreements";
import { completePlanIfDone } from "@/lib/plans";
import { agreementStatusInput } from "@/lib/schemas";
import { audit } from "@/lib/audit";

/** Ends monitoring: the agreement is fulfilled or cancelled. */
export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  const agreement = await loadAgreementForUser(user, params.id);
  if (!serializeAgreement(user, agreement).can.complete) throw forbidden("Kelishuvni yakunlashga ruxsat yo'q");
  const { status, note } = agreementStatusInput.parse(await req.json());
  const completed = status === "COMPLETED";

  await db.$transaction([
    db.agreementUpdate.create({
      data: {
        agreementId: agreement.id,
        note: note ?? (completed ? "Kelishuv yakunlandi" : "Kelishuv bekor qilindi"),
        progress: completed ? 100 : agreement.progress,
        createdById: user.id,
      },
    }),
    db.agreement.update({
      where: { id: agreement.id },
      data: { status, completedAt: new Date(), ...(completed ? { progress: 100 } : {}) },
    }),
  ]);
  await completePlanIfDone(agreement.planId);
  await audit(user, { action: "agreement.close", entityType: "agreement", entityId: agreement.id, summary: `«${agreement.title}» ${completed ? "yakunlandi" : "bekor qilindi"}` }, req);
  return { ok: true };
});
