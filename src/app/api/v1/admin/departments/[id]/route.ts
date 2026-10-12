import { db } from "@/lib/db";
import { badRequest, notFound, requirePermission, withUser } from "@/lib/api";
import { departmentInput } from "@/lib/schemas";

type Params = { id: string };

export const PUT = withUser<Params>(async ({ req, user, params }) => {
  requirePermission(user, "admin:departments");
  const data = departmentInput.parse(await req.json());
  const existing = await db.department.findUnique({ where: { name: data.name } });
  if (existing && existing.id !== params.id) throw badRequest("Bu nomdagi tashkilot mavjud");
  await db.department.update({ where: { id: params.id }, data });
  return { ok: true };
});

export const DELETE = withUser<Params>(async ({ user, params }) => {
  requirePermission(user, "admin:departments");
  const dept = await db.department.findUnique({
    where: { id: params.id },
    include: { _count: { select: { users: true, plans: true } } },
  });
  if (!dept) throw notFound("Tashkilot topilmadi");
  if (dept._count.users > 0 || dept._count.plans > 0) {
    throw badRequest("Xodimlari yoki rejalari bor tashkilotni o'chirib bo'lmaydi");
  }
  await db.department.delete({ where: { id: dept.id } });
  return { ok: true };
});
