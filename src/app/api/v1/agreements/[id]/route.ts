import { db } from "@/lib/db";
import { badRequest, forbidden, withUser } from "@/lib/api";
import { loadAgreementForUser, serializeAgreement } from "@/lib/agreements";
import { agreementInput } from "@/lib/schemas";
import { audit } from "@/lib/audit";

type Params = { id: string };

export const GET = withUser<Params>(async ({ user, params }) => {
  const agreement = await loadAgreementForUser(user, params.id);
  return serializeAgreement(user, agreement);
});

export const PUT = withUser<Params>(async ({ req, user, params }) => {
  const agreement = await loadAgreementForUser(user, params.id);
  if (!serializeAgreement(user, agreement).can.edit) throw forbidden("Kelishuvni tahrirlashga ruxsat yo'q");
  const data = agreementInput.parse(await req.json());
  if (data.planItemId) {
    const item = await db.planItem.findFirst({ where: { id: data.planItemId, planId: agreement.planId } });
    if (!item) throw badRequest("Tanlangan reja bu safarga tegishli emas");
  }
  await db.agreement.update({
    where: { id: agreement.id },
    data: {
      planItemId: data.planItemId,
      title: data.title,
      partner: data.partner,
      partnerCountry: data.partnerCountry,
      documentType: data.documentType,
      documentNumber: data.documentNumber,
      signedDate: data.signedDate ? new Date(data.signedDate) : null,
      amount: data.amount,
      currency: data.currency,
      deadline: new Date(data.deadline),
      description: data.description,
    },
  });
  await audit(user, { action: "agreement.update", entityType: "agreement", entityId: agreement.id, summary: `Kelishuv tahrirlandi: «${data.title}»`, meta: { deadline: { from: agreement.deadline.toISOString().slice(0, 10), to: data.deadline } } }, req);
  return { ok: true };
});
