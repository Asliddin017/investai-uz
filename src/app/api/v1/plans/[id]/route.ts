import { db } from "@/lib/db";
import { badRequest, forbidden, withUser } from "@/lib/api";
import { canEditPlan } from "@/lib/plans";
import { planInput } from "@/lib/schemas";
import { loadPlanForUser, serializePlan } from "@/lib/serialize";
import { deleteFile } from "@/lib/storage";
import { audit } from "@/lib/audit";

type Params = { id: string };

export const GET = withUser<Params>(async ({ user, params }) => {
  const plan = await loadPlanForUser(user, params.id);
  return serializePlan(user, plan);
});

/** Edits are allowed only on a draft or a rejected plan; approved plans are frozen. */
export const PUT = withUser<Params>(async ({ req, user, params }) => {
  const plan = await loadPlanForUser(user, params.id);
  if (!canEditPlan(user, plan)) {
    throw forbidden("Tasdiqlangan yoki tasdiqlashdagi rejani o'zgartirib bo'lmaydi");
  }
  const data = planInput.parse(await req.json());
  await db.$transaction([
    db.planItem.deleteMany({ where: { planId: plan.id } }),
    db.plan.update({
      where: { id: plan.id },
      data: {
        title: data.title,
        goal: data.goal,
        country: data.country,
        city: data.city,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        items: {
          create: data.items.map((item, i) => ({
            order: i + 1,
            title: item.title,
            expectedResult: item.expectedResult,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
          })),
        },
      },
    }),
  ]);
  await audit(user, { action: "plan.update", entityType: "plan", entityId: plan.id, summary: `Reja tahrirlandi: «${data.title}»` }, req);
  return { id: plan.id };
});

export const DELETE = withUser<Params>(async ({ req, user, params }) => {
  const plan = await loadPlanForUser(user, params.id);
  if (!canEditPlan(user, plan) || plan.status !== "DRAFT") {
    throw badRequest("Faqat yuborilmagan qoralamani o'chirish mumkin");
  }
  const attachments = await db.attachment.findMany({ where: { agreement: { planId: plan.id } } });
  await db.plan.delete({ where: { id: plan.id } });
  await Promise.all(attachments.map((a) => deleteFile(a.url)));
  await audit(user, { action: "plan.delete", entityType: "plan", entityId: plan.id, summary: `Qoralama o'chirildi: «${plan.title}»` }, req);
  return { ok: true };
});
