import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "./auth";
import { db } from "./db";
import { badRequest, forbidden, notFound } from "./api";
import { assertCanManageRole, assertUserWithinActor } from "./permission-guard";
import { nameKey } from "./names";

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

/** Whether the actor may review requests from this user (same rules as editing the account). */
export async function canReviewUser(actor: CurrentUser, target: Parameters<typeof assertUserWithinActor>[1] & { role: Parameters<typeof assertCanManageRole>[1] }) {
  try {
    assertCanManageRole(actor, target.role);
    await assertUserWithinActor(actor, target, target);
    return true;
  } catch {
    return false;
  }
}

/** Refuses a name another account already uses (ignoring case, spacing, apostrophes and script). */
export async function assertNameNotTaken(
  client: Pick<Prisma.TransactionClient, "user">,
  userId: string,
  newName: string,
) {
  const key = nameKey(newName);
  const others = await client.user.findMany({ where: { id: { not: userId } }, select: { fullName: true } });
  if (others.some((o) => nameKey(o.fullName) === key)) throw badRequest("Bu F.I.Sh. boshqa xodimga tegishli");
}
