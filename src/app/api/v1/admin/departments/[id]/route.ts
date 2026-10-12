import { db } from "@/lib/db";
import { badRequest, notFound, requirePermission, withUser } from "@/lib/api";
import { departmentInput } from "@/lib/schemas";
import { audit } from "@/lib/audit";

type Params = { id: string };

export const PUT = withUser<Params>(async ({ req, user, params }) => {
  requirePermission(user, "admin:departments");
  const data = departmentInput.parse(await req.json());
  const existing = await db.department.findUnique({ where: { name: data.name } });
  if (existing && existing.id !== params.id) throw badRequest("Bu nomdagi tashkilot mavjud");
  await db.department.update({ where: { id: params.id }, data });
  await audit(user, { action: "department.update", entityType: "department", entityId: params.id, summary: `Tashkilot tahrirlandi: ${data.name}` }, req);
  return { ok: true };
});

export const DELETE = withUser<Params>(async ({ req, user, params }) => {
  requirePermission(user, "admin:departments");
  const dept = await db.department.findUnique({
    where: { id: params.id },
    include: { _count: { select: { users: true, plans: true } } },
  });
  if (!dept) throw notFound("Tashkilot topilmadi");
  if (dept._count.users > 0 || dept._count.plans > 0) {
    throw badRequest("Xodimlari yoki safarlari bor tashkilotni o'chirib bo'lmaydi");
  }
  await db.department.delete({ where: { id: dept.id } });
  await audit(user, { action: "department.delete", entityType: "department", entityId: dept.id, summary: `Tashkilot o'chirildi: ${dept.name}` }, req);
  return { ok: true };
});
