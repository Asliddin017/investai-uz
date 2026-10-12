import { db } from "@/lib/db";
import { badRequest, forbidden, withUser } from "@/lib/api";
import { canManageAgreements } from "@/lib/plans";
import { agreementInput } from "@/lib/schemas";
import { loadPlanForUser } from "@/lib/serialize";
import { audit } from "@/lib/audit";

/** Adds an agreement reached on the trip; planItemId empty = an achievement outside the plan. */
export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  const plan = await loadPlanForUser(user, params.id);
  if (!canManageAgreements(user, plan)) throw forbidden("Kelishuv qo'shishga ruxsat yo'q");
  const data = agreementInput.parse(await req.json());
  if (data.planItemId && !plan.items.some((i) => i.id === data.planItemId)) {
    throw badRequest("Tanlangan reja bu safarga tegishli emas");
  }

  const agreement = await db.agreement.create({
    data: {
      planId: plan.id,
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
      createdById: user.id,
    },
  });
  await audit(user, { action: "agreement.create", entityType: "agreement", entityId: agreement.id, summary: `Kelishuv qo'shildi: «${agreement.title}» (${agreement.partner}), muddat ${data.deadline}` }, req);
  return { id: agreement.id };
});
