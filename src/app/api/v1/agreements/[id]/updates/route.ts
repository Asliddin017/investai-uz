import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, forbidden, withUser } from "@/lib/api";
import { loadAgreementForUser, progressFromDecimal, serializeAgreement } from "@/lib/agreements";
import { agreementUpdateInput } from "@/lib/schemas";
import { audit } from "@/lib/audit";

/**
 * A monitoring entry: what was done and, for an agreement with a sum, how much money arrived.
 * The percentage then follows from the money; without a sum the author sets it directly.
 */
export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  const agreement = await loadAgreementForUser(user, params.id);
  if (!serializeAgreement(user, agreement).can.monitor) throw forbidden("Monitoring yozuvi qo'shishga ruxsat yo'q");
  const data = agreementUpdateInput.parse(await req.json());
  const received = new Prisma.Decimal(data.amount ?? 0);

  if (agreement.amount === null) {
    if (received.gt(0)) throw badRequest("Kelishuvda summa ko'rsatilmagan: avval summani kiriting");
    const progress = data.progress ?? agreement.progress;
    await db.$transaction([
      db.agreementUpdate.create({ data: { agreementId: agreement.id, note: data.note, progress, createdById: user.id } }),
      db.agreement.update({ where: { id: agreement.id }, data: { progress } }),
    ]);
    await audit(user, { action: "agreement.progress", entityType: "agreement", entityId: agreement.id, summary: `«${agreement.title}»: ${progress}% — ${data.note}` }, req);
    return { ok: true };
  }

  const remaining = agreement.amount.minus(agreement.absorbedAmount);
  if (received.gt(remaining)) {
    throw badRequest(`Qolgan summadan ko'p kiritib bo'lmaydi. Qolgan: ${remaining.toNumber()} ${agreement.currency ?? ""}`.trim());
  }
  const absorbed = agreement.absorbedAmount.plus(received);
  const progress = progressFromDecimal(agreement.amount, absorbed);
  await db.$transaction(async (tx) => {
    // Matching on the value we read stops two simultaneous entries from exceeding the sum together.
    const { count } = await tx.agreement.updateMany({
      where: { id: agreement.id, absorbedAmount: agreement.absorbedAmount },
      data: { absorbedAmount: absorbed, progress },
    });
    if (count === 0) throw badRequest("Ma'lumot o'zgargan: sahifani yangilab, qayta urinib ko'ring");
    await tx.agreementUpdate.create({
      data: { agreementId: agreement.id, note: data.note, progress, amount: received.gt(0) ? received : null, createdById: user.id },
    });
  });
  const summary = received.gt(0)
    ? `«${agreement.title}»: +${received.toNumber()} ${agreement.currency ?? ""}, ${progress}% — ${data.note}`
    : `«${agreement.title}»: ${progress}% — ${data.note}`;
  await audit(user, { action: "agreement.progress", entityType: "agreement", entityId: agreement.id, summary }, req);
  return { ok: true };
});
