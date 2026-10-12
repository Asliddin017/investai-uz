import { db } from "@/lib/db";
import { badRequest, notFound, requirePermission, withUser } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { userInput } from "@/lib/schemas";
import { assertCanManageRole, assertUserWithinActor } from "@/lib/permission-guard";

export const PUT = withUser<{ id: string }>(async ({ req, user, params }) => {
  requirePermission(user, "admin:users");
  const target = await db.user.findUnique({ where: { id: params.id } });
  if (!target) throw notFound("Foydalanuvchi topilmadi");
  const data = userInput.parse(await req.json());
  assertCanManageRole(user, target.role, data.role);
  await assertUserWithinActor(user, target, { role: data.role, departmentId: data.departmentId });

  if (
    target.id === user.id &&
    (!data.isActive || data.role !== target.role || data.departmentId !== target.departmentId)
  ) {
    throw badRequest("O'z hisobingizni o'chira, rolini yoki tashkilotini o'zgartira olmaysiz");
  }
  if (data.username !== target.username) {
    const taken = await db.user.findUnique({ where: { username: data.username } });
    if (taken) throw badRequest("Bu login band");
  }
  if (data.password && data.password.length < 8) throw badRequest("Parol kamida 8 belgi bo'lsin");

  await db.user.update({
    where: { id: target.id },
    data: {
      fullName: data.fullName,
      username: data.username,
      role: data.role,
      position: data.position,
      departmentId: data.departmentId,
      isActive: data.isActive,
      ...(data.password
        ? { passwordHash: await hashPassword(data.password), sessionVersion: { increment: 1 } }
        : {}),
    },
  });
  return { ok: true };
});
