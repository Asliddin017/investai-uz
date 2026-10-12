import { db } from "@/lib/db";
import { badRequest, withUser } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { passwordChangeInput } from "@/lib/schemas";

export const PUT = withUser(async ({ req, user }) => {
  const { currentPassword, newPassword } = passwordChangeInput.parse(await req.json());
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(currentPassword, row.passwordHash))) {
    throw badRequest("Joriy parol noto'g'ri");
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  return { ok: true };
});
