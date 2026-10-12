import { db } from "@/lib/db";
import { badRequest, withUser } from "@/lib/api";

/** The author withdraws a request that has not been reviewed yet. */
export const DELETE = withUser<{ id: string }>(async ({ user, params }) => {
  const { count } = await db.nameChangeRequest.updateMany({
    where: { id: params.id, userId: user.id, status: "PENDING" },
    data: { status: "CANCELLED", reviewedAt: new Date() },
  });
  if (count === 0) throw badRequest("Bekor qilinadigan so'rov topilmadi");
  return { ok: true };
});
