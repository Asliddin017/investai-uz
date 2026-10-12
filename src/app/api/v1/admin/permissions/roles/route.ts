import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, requirePermission, withUser } from "@/lib/api";
import { LOCKED_SUPER_ADMIN_PERMISSIONS, PERMISSION_KEYS, ROLES } from "@/lib/permissions";
import { rolesMatrixInput } from "@/lib/schemas";

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

  const writes = [];
  for (const [role, perms] of Object.entries(roles)) {
    if (!ROLE_SET.has(role)) throw badRequest(`Noma'lum rol: ${role}`);
    const unknown = perms.find((p) => !PERMISSION_KEYS.has(p));
    if (unknown) throw badRequest(`Noma'lum ruxsat: ${unknown}`);
    const set = new Set(perms);
    if (role === "SUPER_ADMIN") for (const locked of LOCKED_SUPER_ADMIN_PERMISSIONS) set.add(locked);
    writes.push(
      db.rolePermission.deleteMany({ where: { role: role as Role } }),
      db.rolePermission.createMany({ data: [...set].map((permission) => ({ role: role as Role, permission })) }),
    );
  }
  await db.$transaction(writes);
  return { ok: true };
});
