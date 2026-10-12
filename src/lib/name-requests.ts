import type { CurrentUser } from "./auth";
import { db } from "./db";
import { badRequest, forbidden, notFound } from "./api";
import { assertCanManageRole, assertUserWithinActor } from "./permission-guard";

/** Loads a pending request and checks the reviewer may decide on it. */
export async function loadReviewableRequest(actor: CurrentUser, id: string) {
  const request = await db.nameChangeRequest.findUnique({ where: { id }, include: { user: true } });
  if (!request) throw notFound("So'rov topilmadi");
  if (request.status !== "PENDING") throw badRequest("So'rov allaqachon ko'rib chiqilgan");
  if (request.userId === actor.id) throw forbidden("O'z so'rovingizni o'zingiz ko'rib chiqa olmaysiz");
  assertCanManageRole(actor, request.user.role);
  await assertUserWithinActor(actor, request.user, request.user);
  return request;
}
