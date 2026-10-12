import { db } from "@/lib/db";
import { forbidden, withUser } from "@/lib/api";
import { loadAgreementForUser, serializeAgreement } from "@/lib/agreements";
import { agreementUpdateInput } from "@/lib/schemas";

/** A monitoring entry: what was done during the agreement's term and the progress reached. */
export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  const agreement = await loadAgreementForUser(user, params.id);
  if (!serializeAgreement(user, agreement).can.monitor) throw forbidden("Monitoring yozuvi qo'shishga ruxsat yo'q");
  const data = agreementUpdateInput.parse(await req.json());
  await db.$transaction([
    db.agreementUpdate.create({
      data: { agreementId: agreement.id, note: data.note, progress: data.progress, createdById: user.id },
    }),
    db.agreement.update({ where: { id: agreement.id }, data: { progress: data.progress } }),
  ]);
  return { ok: true };
});
