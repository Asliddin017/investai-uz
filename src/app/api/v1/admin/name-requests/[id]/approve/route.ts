import { db } from "@/lib/db";
import { badRequest, requirePermission, withUser } from "@/lib/api";
import { loadReviewableRequest } from "@/lib/name-requests";
import { reviewInput } from "@/lib/schemas";

export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  requirePermission(user, "admin:users");
  const request = await loadReviewableRequest(user, params.id);
  const { comment } = reviewInput.parse(await req.json().catch(() => ({})));
  if (request.user.fullName !== request.oldName) {
    throw badRequest("Xodimning ismi so'rov yuborilgandan keyin o'zgargan — so'rovni rad eting");
  }

  await db.$transaction(async (tx) => {
    // Conditional update guards against two reviewers deciding at the same time.
    const { count } = await tx.nameChangeRequest.updateMany({
      where: { id: request.id, status: "PENDING" },
      data: { status: "APPROVED", reviewerId: user.id, reviewComment: comment, reviewedAt: new Date() },
    });
    if (count === 0) throw badRequest("So'rov allaqachon ko'rib chiqilgan");
    await tx.user.update({ where: { id: request.userId }, data: { fullName: request.newName } });
  });
  return { ok: true };
});
