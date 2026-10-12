import { db } from "@/lib/db";
import { badRequest, notFound, requirePermission, withUser } from "@/lib/api";
import { generateTempPassword, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertCanManageRole, assertUserWithinActor } from "@/lib/permission-guard";

/**
 * Issues a one-time password for a user who forgot theirs. It is returned once and never stored
 * in clear; the user must choose a new one at next sign-in, and all their sessions end.
 */
export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  requirePermission(user, "admin:users");
  const target = await db.user.findUnique({ where: { id: params.id } });
  if (!target) throw notFound("Foydalanuvchi topilmadi");
  if (target.id === user.id) throw badRequest("O'z parolingizni Profil sahifasida o'zgartiring");
  assertCanManageRole(user, target.role);
  await assertUserWithinActor(user, target, target);

  const password = generateTempPassword();
  await db.user.update({
    where: { id: target.id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: true, sessionVersion: { increment: 1 } },
  });
  await audit(
    user,
    {
      action: "user.password_reset",
      entityType: "user",
      entityId: target.id,
      summary: `Vaqtinchalik parol berildi: ${target.fullName} (@${target.username})`,
    },
    req,
  );
  return { password };
});
