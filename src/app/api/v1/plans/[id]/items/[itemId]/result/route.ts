import { db } from "@/lib/db";
import { forbidden, notFound, withUser } from "@/lib/api";
import { canReportPlan } from "@/lib/plans";
import { itemResultInput } from "@/lib/schemas";
import { loadPlanForUser } from "@/lib/serialize";

export const PUT = withUser<{ id: string; itemId: string }>(async ({ req, user, params }) => {
  const plan = await loadPlanForUser(user, params.id);
  if (!canReportPlan(user, plan)) throw forbidden("Natijani faqat tasdiqlangan rejaga kiritish mumkin");
  const item = plan.items.find((i) => i.id === params.itemId);
  if (!item) throw notFound("Reja bandi topilmadi");

  const data = itemResultInput.parse(await req.json());
  await db.planItem.update({
    where: { id: item.id },
    data: {
      result: data.result,
      resultNote: data.resultNote,
      failureReason: data.result === "NOT_ACHIEVED" ? data.failureReason : null,
    },
  });
  return { ok: true };
});
