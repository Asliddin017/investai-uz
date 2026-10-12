import { db } from "@/lib/db";
import { badRequest, notFound, requirePermission, withUser } from "@/lib/api";
import { loadUserWithPermissions } from "@/lib/auth";
import { PERMISSION_KEYS } from "@/lib/permissions";
import {
  assertActorKeepsPermissionAdmin,
  assertCanManageRole,
  assertUserOverridesWithinActor,
  assertUserWithinActor,
} from "@/lib/permission-guard";
import { overridesInput } from "@/lib/schemas";
import { audit } from "@/lib/audit";

type Params = { id: string };

export const GET = withUser<Params>(async ({ user, params }) => {
  requirePermission(user, "admin:permissions");
  const target = await db.user.findUnique({
    where: { id: params.id },
    include: { permissions: true, department: { include: { permissions: true } } },
  });
  if (!target) throw notFound("Foydalanuvchi topilmadi");
  const [roleDefaults, effective] = await Promise.all([
    db.rolePermission.findMany({ where: { role: target.role } }),
    loadUserWithPermissions(target.id),
  ]);
  return {
    role: target.role,
    departmentName: target.department?.name ?? null,
    role_defaults: roleDefaults.map((r) => r.permission),
    department_overrides: (target.department?.permissions ?? []).map(({ permission, state }) => ({ permission, state })),
    overrides: target.permissions.map(({ permission, state, reason }) => ({ permission, state, reason })),
    effective: effective ? [...effective.permissions] : [],
  };
});

/** Replaces the user's personal overrides — the most specific level, applied last. */
export const PUT = withUser<Params>(async ({ req, user, params }) => {
  requirePermission(user, "admin:permissions");
  const target = await db.user.findUnique({ where: { id: params.id } });
  if (!target) throw notFound("Foydalanuvchi topilmadi");
  const { overrides } = overridesInput.parse(await req.json());
  const unknown = overrides.find((o) => !PERMISSION_KEYS.has(o.permission));
  if (unknown) throw badRequest(`Noma'lum ruxsat: ${unknown.permission}`);
  assertCanManageRole(user, target.role);
  await assertUserWithinActor(user, target, target);
  await assertUserOverridesWithinActor(user, target, overrides);
  if (target.id === user.id) await assertActorKeepsPermissionAdmin(user, { userOverrides: overrides });

  await db.$transaction([
    db.userPermission.deleteMany({ where: { userId: target.id } }),
    db.userPermission.createMany({
      data: overrides.map((o) => ({ userId: target.id, permission: o.permission, state: o.state, reason: o.reason })),
    }),
  ]);
  await audit(user, { action: "permissions.user", entityType: "user", entityId: target.id, summary: `${target.fullName} (@${target.username}): ${overrides.length} ta shaxsiy sozlama`, meta: overrides }, req);
  return { ok: true };
});
