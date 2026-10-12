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

/** A non-Super-Admin can only hand out permissions they hold themselves. */
export function assertGrantsWithinActor(actor: CurrentUser, permissions: Iterable<string>) {
  if (actor.role === "SUPER_ADMIN") return;
  const missing = [...permissions].filter((p) => !actor.permissions.has(p));
  if (missing.length > 0) {
    throw forbidden(`O'zingizda yo'q ruxsatni bera olmaysiz: ${missing.join(", ")}`);
  }
}

async function effectiveFor(role: Role, departmentId: string | null, userOverrides: Override[]) {
  const [roleRows, deptRows] = await Promise.all([
    db.rolePermission.findMany({ where: { role } }),
    departmentId ? db.departmentPermission.findMany({ where: { departmentId } }) : Promise.resolve([]),
  ]);
  return resolvePermissions(
    roleRows.map((r) => r.permission),
    deptRows,
    userOverrides,
  );
}

/**
 * A non-Super-Admin may only create or edit an account whose effective permissions —
 * before and after the change — stay within the actor's own. Blocks taking over a
 * stronger account (password reset) and moving someone into a more privileged role or
 * organization.
 */
export async function assertUserWithinActor(
  actor: CurrentUser,
  target: { id?: string; role: Role; departmentId: string | null } | null,
  next: { role: Role; departmentId: string | null },
) {
  if (actor.role === "SUPER_ADMIN") return;
  const overrides = target?.id ? await db.userPermission.findMany({ where: { userId: target.id } }) : [];
  if (target) assertGrantsWithinActor(actor, await effectiveFor(target.role, target.departmentId, overrides));
  assertGrantsWithinActor(actor, await effectiveFor(next.role, next.departmentId, overrides));
}

/**
 * Every permission a user gains from an override change — an explicit grant or a removed
 * deny — must be one the acting admin holds.
 */
export async function assertUserOverridesWithinActor(
  actor: CurrentUser,
  target: { id: string; role: Role; departmentId: string | null },
  nextOverrides: Override[],
) {
  if (actor.role === "SUPER_ADMIN") return;
  const current = await db.userPermission.findMany({ where: { userId: target.id } });
  const before = await effectiveFor(target.role, target.departmentId, current);
  const after = await effectiveFor(target.role, target.departmentId, nextOverrides);
  assertGrantsWithinActor(actor, [...after].filter((p) => !before.has(p)));
}

/** Same rule for a department change, checked for every member of the organization. */
export async function assertDepartmentOverridesWithinActor(
  actor: CurrentUser,
  departmentId: string,
  nextOverrides: Override[],
) {
  if (actor.role === "SUPER_ADMIN") return;
  const [members, currentDept, roleRows] = await Promise.all([
    db.user.findMany({ where: { departmentId }, include: { permissions: true } }),
    db.departmentPermission.findMany({ where: { departmentId } }),
    db.rolePermission.findMany(),
  ]);
  const gained = new Set<string>();
  for (const m of members) {
    const roleDefaults = roleRows.filter((r) => r.role === m.role).map((r) => r.permission);
    const before = resolvePermissions(roleDefaults, currentDept, m.permissions);
    const after = resolvePermissions(roleDefaults, nextOverrides, m.permissions);
    for (const p of after) if (!before.has(p)) gained.add(p);
  }
  // Grants also apply to people who join later, so they are limited even with no members today.
  for (const o of nextOverrides) if (o.state === "GRANT") gained.add(o.permission);
  assertGrantsWithinActor(actor, gained);
}

/** Department-wide overrides also reach Super Admins in that organization. */
export async function assertCanEditDepartmentPermissions(actor: CurrentUser, departmentId: string) {
  if (actor.role === "SUPER_ADMIN") return;
  const superAdmins = await db.user.count({ where: { departmentId, role: "SUPER_ADMIN" } });
  if (superAdmins > 0) throw forbidden("Super Admin ishlaydigan tashkilot ruxsatlarini faqat Super Admin o'zgartiradi");
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
