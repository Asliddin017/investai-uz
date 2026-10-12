import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, forbidden, requirePermission, withUser } from "@/lib/api";
import { LOCKED_SUPER_ADMIN_PERMISSIONS, PERMISSION_KEYS, ROLES } from "@/lib/permissions";
import { rolesMatrixInput } from "@/lib/schemas";
import { assertActorKeepsPermissionAdmin, assertGrantsWithinActor } from "@/lib/permission-guard";
import { audit } from "@/lib/audit";

const ROLE_SET = new Set<string>(ROLES.map((r) => r.value));

export const GET = withUser(async ({ user }) => {
  requirePermission(user, "admin:permissions");
  const rows = await db.rolePermission.findMany();
  const roles: Record<string, string[]> = Object.fromEntries(ROLES.map((r) => [r.value, []]));
  for (const row of rows) roles[row.role]?.push(row.permission);
  return { roles };
});

/** Replaces the role → permission matrix for the roles sent in the body. */
export const PUT = withUser(async ({ req, user }) => {
  requirePermission(user, "admin:permissions");
  const { roles } = rolesMatrixInput.parse(await req.json());

  if ("SUPER_ADMIN" in roles && user.role !== "SUPER_ADMIN") {
    throw forbidden("Super Admin rolini faqat Super Admin o'zgartiradi");
  }

  const normalized: Record<string, string[]> = {};
  for (const [role, perms] of Object.entries(roles)) {
    if (!ROLE_SET.has(role)) throw badRequest(`Noma'lum rol: ${role}`);
    const unknown = perms.find((p) => !PERMISSION_KEYS.has(p));
    if (unknown) throw badRequest(`Noma'lum ruxsat: ${unknown}`);
    const set = new Set(perms);
    if (role === "SUPER_ADMIN") for (const locked of LOCKED_SUPER_ADMIN_PERMISSIONS) set.add(locked);
    normalized[role] = [...set];
  }
  const current = await db.rolePermission.findMany({ where: { role: { in: Object.keys(normalized) as Role[] } } });
  const had = new Set(current.map((r) => `${r.role}|${r.permission}`));
  assertGrantsWithinActor(
    user,
    Object.entries(normalized).flatMap(([role, perms]) => perms.filter((p) => !had.has(`${role}|${p}`))),
  );
  await assertActorKeepsPermissionAdmin(user, { roleDefaults: normalized });

  const writes = Object.entries(normalized).flatMap(([role, perms]) => [
    db.rolePermission.deleteMany({ where: { role: role as Role } }),
    db.rolePermission.createMany({ data: perms.map((permission) => ({ role: role as Role, permission })) }),
  ]);
  await db.$transaction(writes);
  const changes = Object.entries(normalized).map(([role, perms]) => {
    const before = new Set(current.filter((c) => c.role === role).map((c) => c.permission));
    return { role, added: perms.filter((p) => !before.has(p)), removed: [...before].filter((p) => !perms.includes(p)) };
  });
  await audit(
    user,
    {
      action: "permissions.roles",
      entityType: "role",
      summary: changes.map((c) => `${c.role}: +${c.added.length} / −${c.removed.length}`).join("; "),
      meta: changes,
    },
    req,
  );
  return { ok: true };
});
