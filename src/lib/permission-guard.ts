import type { Role } from "@prisma/client";
import type { CurrentUser } from "./auth";
import { db } from "./db";
import { badRequest, forbidden } from "./api";
import { resolvePermissions, type Override } from "./permissions";

/** Only a Super Admin may create, promote to, or modify a Super Admin account. */
export function assertCanManageRole(actor: CurrentUser, targetRole: Role, newRole?: Role) {
  if (actor.role === "SUPER_ADMIN") return;
  if (targetRole === "SUPER_ADMIN" || newRole === "SUPER_ADMIN") {
    throw forbidden("Super Admin hisobini faqat Super Admin boshqaradi");
  }
}

/**
 * Refuses a permission change that would strip the acting admin of `admin:permissions`
 * at any level (role matrix, own department, own user overrides) — otherwise one save
 * can lock the last administrator out.
 */
export async function assertActorKeepsPermissionAdmin(
  actor: CurrentUser,
  change: { roleDefaults?: Record<string, string[]>; departmentId?: string; departmentOverrides?: Override[]; userOverrides?: Override[] },
) {
  const affectsRole = change.roleDefaults && actor.role in change.roleDefaults;
  const affectsDept = change.departmentId !== undefined && change.departmentId === actor.departmentId;
  const affectsUser = change.userOverrides !== undefined;
  if (!affectsRole && !affectsDept && !affectsUser) return;

  const current = await db.user.findUniqueOrThrow({
    where: { id: actor.id },
    include: { permissions: true, department: { include: { permissions: true } } },
  });
  const roleDefaults = affectsRole
    ? change.roleDefaults![actor.role]
    : (await db.rolePermission.findMany({ where: { role: actor.role } })).map((r) => r.permission);
  const deptOverrides = affectsDept ? change.departmentOverrides! : (current.department?.permissions ?? []);
  const userOverrides = affectsUser ? change.userOverrides! : current.permissions;

  if (!resolvePermissions(roleDefaults, deptOverrides, userOverrides).has("admin:permissions")) {
    throw badRequest("Bu o'zgarish sizni ruxsatlarni boshqarish huquqidan mahrum qiladi");
  }
}
