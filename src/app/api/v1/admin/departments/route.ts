import { db } from "@/lib/db";
import { badRequest, requirePermission, withUser } from "@/lib/api";
import { departmentInput } from "@/lib/schemas";

export const GET = withUser(async ({ user }) => {
  requirePermission(user, "admin:departments", "admin:permissions", "admin:users");
  return db.department.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: { _count: { select: { users: true, plans: true, permissions: true } } },
  });
});

export const POST = withUser(async ({ req, user }) => {
  requirePermission(user, "admin:departments");
  const data = departmentInput.parse(await req.json());
  if (await db.department.findUnique({ where: { name: data.name } })) {
    throw badRequest("Bu nomdagi tashkilot mavjud");
  }
  const created = await db.department.create({ data });
  return { id: created.id };
});
