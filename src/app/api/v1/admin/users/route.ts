import { db } from "@/lib/db";
import { badRequest, requirePermission, withUser } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { userInput } from "@/lib/schemas";
import { assertCanManageRole, assertUserWithinActor } from "@/lib/permission-guard";

export const GET = withUser(async ({ user }) => {
  requirePermission(user, "admin:users", "admin:permissions");
  return db.user.findMany({
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
      position: true,
      isActive: true,
      lastLoginAt: true,
      departmentId: true,
      department: { select: { name: true } },
      _count: { select: { permissions: true, plans: true } },
    },
  });
});

export const POST = withUser(async ({ req, user }) => {
  requirePermission(user, "admin:users");
  const data = userInput.parse(await req.json());
  assertCanManageRole(user, data.role);
  await assertUserWithinActor(user, null, { role: data.role, departmentId: data.departmentId });
  if (!data.password || data.password.length < 8) throw badRequest("Parol kamida 8 belgi bo'lsin");
  const exists = await db.user.findUnique({ where: { username: data.username } });
  if (exists) throw badRequest("Bu login band");
  const created = await db.user.create({
    data: {
      fullName: data.fullName,
      username: data.username,
      passwordHash: await hashPassword(data.password),
      role: data.role,
      position: data.position,
      departmentId: data.departmentId,
      isActive: data.isActive,
    },
  });
  return { id: created.id };
});
