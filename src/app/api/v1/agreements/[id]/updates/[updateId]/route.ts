import { db } from "@/lib/db";
import { badRequest, forbidden, notFound, withUser } from "@/lib/api";
import { loadAgreementForUser, progressFromDecimal, serializeAgreement } from "@/lib/agreements";
import { audit } from "@/lib/audit";

/** Removes a mistaken monitoring entry: its money is taken back, or the latest remaining percentage applies. */
export const DELETE = withUser<{ id: string; updateId: string }>(async ({ req, user, params }) => {
  const agreement = await loadAgreementForUser(user, params.id);
  const entry = agreement.updates.find((u) => u.id === params.updateId);
  if (!entry) throw notFound("Monitoring yozuvi topilmadi");
  if (!serializeAgreement(user, agreement).can.monitor || entry.createdById !== user.id) {
    throw forbidden("Faqat o'zingiz yozgan izohni o'chira olasiz");
  }
  const absorbed = entry.amount ? agreement.absorbedAmount.minus(entry.amount) : agreement.absorbedAmount;
  const progress = agreement.amount
    ? progressFromDecimal(agreement.amount, absorbed)
    : (agreement.updates.find((u) => u.id !== entry.id)?.progress ?? 0);
  await db.$transaction(async (tx) => {
    const { count } = await tx.agreement.updateMany({
      where: { id: agreement.id, absorbedAmount: agreement.absorbedAmount },
      data: { absorbedAmount: absorbed, progress },
    });
    if (count === 0) throw badRequest("Ma'lumot o'zgargan: sahifani yangilab, qayta urinib ko'ring");
    await tx.agreementUpdate.delete({ where: { id: entry.id } });
  });
  await audit(user, { action: "agreement.progress_delete", entityType: "agreement", entityId: agreement.id, summary: `«${agreement.title}»: ${entry.progress}% izoh o'chirildi — ${entry.note}` }, req);
  return { ok: true, progress };
});
