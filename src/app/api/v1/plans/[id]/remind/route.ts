import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, forbidden, withUser } from "@/lib/api";
import { canRemindReport } from "@/lib/plans";
import { loadPlanForUser } from "@/lib/serialize";

const remindInput = z.object({ message: z.string().trim().max(500).optional().nullable() });
const REPEAT_AFTER_MS = 24 * 60 * 60 * 1000;

/** The approver asks the author to close the trip report (at most once a day per plan). */
export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  const plan = await loadPlanForUser(user, params.id);
  if (!canRemindReport(user, plan)) throw forbidden("Bu reja uchun hisobot so'rab bo'lmaydi");
  const { message } = remindInput.parse(await req.json().catch(() => ({})));

  const last = plan.reminders[0];
  if (last && Date.now() - last.createdAt.getTime() < REPEAT_AFTER_MS) {
    throw badRequest("Hisobot so'nggi 24 soat ichida so'ralgan");
  }
  await db.reportReminder.create({ data: { planId: plan.id, requestedById: user.id, message: message || null } });
  return { ok: true };
});
