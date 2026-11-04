import { db } from "@/lib/db";
import { badRequest, forbidden, withUser } from "@/lib/api";
import { loadAgreementForUser, serializeAgreement } from "@/lib/agreements";
import { completePlanIfDone } from "@/lib/plans";
import { agreementStatusInput } from "@/lib/schemas";
import { audit } from "@/lib/audit";
import { markAgreementSeen } from "@/lib/inbox";
import { CLOSE_NEEDS_DOCUMENT } from "@/lib/labels";

/** Ends monitoring: the agreement is fulfilled or cancelled. */
export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  const agreement = await loadAgreementForUser(user, params.id);
  if (!serializeAgreement(user, agreement).can.complete) throw forbidden("Kelishuvni yakunlashga ruxsat yo'q");
  const { status, note } = agreementStatusInput.parse(await req.json());
  const completed = status === "COMPLETED";
  if (completed && agreement.attachments.length === 0) throw badRequest(CLOSE_NEEDS_DOCUMENT);

  // With a sum, the percentage stays what the money says; closing does not invent the rest.
  const finalProgress = completed && agreement.amount === null ? 100 : agreement.progress;

  await db.$transaction([
    db.agreementUpdate.create({
      data: {
        agreementId: agreement.id,
        note: note ?? (completed ? "Kelishuv yakunlandi" : "Kelishuv bekor qilindi"),
        progress: finalProgress,
        createdById: user.id,
      },
    }),
    db.agreement.update({
      where: { id: agreement.id },
      data: { status, completedAt: new Date(), progress: finalProgress },
    }),
  ]);
  await completePlanIfDone(agreement.planId);
  // The approver can close from the list without opening the agreement; nothing is news to them after that.
  await markAgreementSeen(user.id, agreement.id);
  await audit(user, { action: "agreement.close", entityType: "agreement", entityId: agreement.id, summary: `«${agreement.title}» ${completed ? "yakunlandi" : "bekor qilindi"}` }, req);
  return { ok: true };
});
