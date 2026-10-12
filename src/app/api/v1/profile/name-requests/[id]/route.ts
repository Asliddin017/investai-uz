import { db } from "@/lib/db";
import { badRequest, withUser } from "@/lib/api";
import { audit } from "@/lib/audit";

/** The author withdraws a request that has not been reviewed yet. */
export const DELETE = withUser<{ id: string }>(async ({ req, user, params }) => {
  const { count } = await db.nameChangeRequest.updateMany({
    where: { id: params.id, userId: user.id, status: "PENDING" },
    data: { status: "CANCELLED", reviewedAt: new Date() },
  });
  if (count === 0) throw badRequest("Bekor qilinadigan so'rov topilmadi");
  await audit(user, { action: "name_request.cancel", entityType: "user", entityId: user.id, summary: "Ism so'rovi bekor qilindi" }, req);
  return { ok: true };
});
