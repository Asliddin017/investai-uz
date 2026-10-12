import { db } from "@/lib/db";
import { badRequest, notFound, requirePermission, withUser } from "@/lib/api";
import { PERMISSION_KEYS } from "@/lib/permissions";
import { overridesInput } from "@/lib/schemas";
import {
  assertActorKeepsPermissionAdmin,
  assertCanEditDepartmentPermissions,
  assertDepartmentOverridesWithinActor,
} from "@/lib/permission-guard";
import { audit } from "@/lib/audit";

type Params = { id: string };

export const GET = withUser<Params>(async ({ user, params }) => {
  requirePermission(user, "admin:permissions");
  const dept = await db.department.findUnique({ where: { id: params.id }, include: { permissions: true } });
  if (!dept) throw notFound("Tashkilot topilmadi");
  return {
    overrides: dept.permissions.map(({ permission, state, reason }) => ({ permission, state, reason })),
  };
});

/** Replaces the department's overrides; permissions left out fall back to the role default. */
export const PUT = withUser<Params>(async ({ req, user, params }) => {
  requirePermission(user, "admin:permissions");
  const dept = await db.department.findUnique({ where: { id: params.id } });
  if (!dept) throw notFound("Tashkilot topilmadi");
  const { overrides } = overridesInput.parse(await req.json());
  const unknown = overrides.find((o) => !PERMISSION_KEYS.has(o.permission));
  if (unknown) throw badRequest(`Noma'lum ruxsat: ${unknown.permission}`);
  await assertCanEditDepartmentPermissions(user, dept.id);
  await assertDepartmentOverridesWithinActor(user, dept.id, overrides);
  await assertActorKeepsPermissionAdmin(user, { departmentId: dept.id, departmentOverrides: overrides });

  await db.$transaction([
    db.departmentPermission.deleteMany({ where: { departmentId: dept.id } }),
    db.departmentPermission.createMany({
      data: overrides.map((o) => ({ departmentId: dept.id, permission: o.permission, state: o.state, reason: o.reason })),
    }),
  ]);
  await audit(user, { action: "permissions.department", entityType: "department", entityId: dept.id, summary: `${dept.name}: ${overrides.length} ta sozlama`, meta: overrides }, req);
  return { ok: true };
});
