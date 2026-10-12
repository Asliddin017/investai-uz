import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, requirePermission, withUser } from "@/lib/api";
import { loadReviewableRequest } from "@/lib/name-requests";
import { audit } from "@/lib/audit";

const rejectInput = z.object({ comment: z.string().trim().min(3, "Rad etish sababini yozing") });

export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  requirePermission(user, "admin:users");
  const request = await loadReviewableRequest(user, params.id);
  const { comment } = rejectInput.parse(await req.json());
  const { count } = await db.nameChangeRequest.updateMany({
    where: { id: request.id, status: "PENDING" },
    data: { status: "REJECTED", reviewerId: user.id, reviewComment: comment, reviewedAt: new Date() },
  });
  if (count === 0) throw badRequest("So'rov allaqachon ko'rib chiqilgan");
  await audit(user, { action: "name_request.reject", entityType: "user", entityId: request.userId, summary: `Ism so'rovi rad etildi: ${request.newName} (@${request.user.username}) — ${comment}` }, req);
  return { ok: true };
});
