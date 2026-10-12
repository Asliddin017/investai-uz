import type { OverrideState, Role } from "@prisma/client";

export type PermissionDef = {
  key: string;
  label_uz: string;
  category: PermissionCategory;
};

export type PermissionCategory = "nav" | "plan" | "agreement" | "ai" | "admin";

export const CATEGORY_LABELS: Record<PermissionCategory, string> = {
  nav: "Menyu",
  plan: "Safarlar",
  agreement: "Kelishuvlar",
  ai: "AI tahlil",
  admin: "Boshqaruv",
};

export const CATEGORY_ORDER: PermissionCategory[] = ["nav", "plan", "agreement", "ai", "admin"];

export const PERMISSIONS: PermissionDef[] = [
  { key: "nav:dashboard", label_uz: "Dashboard sahifasini ko'rish", category: "nav" },
  { key: "nav:plans", label_uz: "Safarlar bo'limini ko'rish", category: "nav" },
  { key: "nav:agreements", label_uz: "Kelishuvlar bo'limini ko'rish", category: "nav" },

  { key: "plan:create", label_uz: "Safar yaratish va tahrirlash", category: "plan" },
  { key: "plan:view_own", label_uz: "O'z safarlarini ko'rish", category: "plan" },
  { key: "plan:view_department", label_uz: "O'z tashkiloti safarlarini ko'rish", category: "plan" },
  { key: "plan:view_all", label_uz: "Barcha safarlarni ko'rish", category: "plan" },
  { key: "plan:approve", label_uz: "Safarni tasdiqlash yoki rad etish", category: "plan" },
  { key: "plan:report", label_uz: "Safar natijalarini kiritish", category: "plan" },
  { key: "plan:remind_report", label_uz: "Hisobotni yakunlashni so'rash", category: "plan" },

  { key: "agreement:manage", label_uz: "Kelishuv qo'shish va asos biriktirish", category: "agreement" },
  { key: "agreement:monitor", label_uz: "Kelishuv monitoringini yuritish", category: "agreement" },
  { key: "agreement:complete", label_uz: "Kelishuvni yakunlash yoki bekor qilish", category: "agreement" },

  { key: "ai:analyze", label_uz: "AI moslik tahlilini ishga tushirish", category: "ai" },

  { key: "admin:users", label_uz: "Foydalanuvchilarni boshqarish", category: "admin" },
  { key: "admin:departments", label_uz: "Tashkilotlarni boshqarish", category: "admin" },
  { key: "admin:permissions", label_uz: "Ruxsatlarni boshqarish", category: "admin" },
  { key: "admin:audit", label_uz: "Amallar jurnalini ko'rish", category: "admin" },
];

export const PERMISSION_KEYS = new Set(PERMISSIONS.map((p) => p.key));

export const ROLES: { value: Role; label: string; short: string }[] = [
  { value: "SUPER_ADMIN", label: "Super Admin", short: "S.Admin" },
  { value: "TASDIQLOVCHI", label: "Kotibiyat mudiri (tasdiqlovchi)", short: "Tasdiq." },
  { value: "ORINBOSAR", label: "Viloyat apparati o'rinbosari", short: "O'rinb." },
  { value: "BOSHQARMA_BOSHLIGI", label: "Boshqarma boshlig'i", short: "Boshq." },
  { value: "TUMAN_HOKIMI", label: "Tuman/shahar hokimi", short: "Hokim" },
  { value: "KUZATUVCHI", label: "Kuzatuvchi", short: "Kuzat." },
];

export const ROLE_LABELS = Object.fromEntries(ROLES.map((r) => [r.value, r.label])) as Record<Role, string>;

/** Super Admin cannot lose these — otherwise nobody could manage access anymore. */
export const LOCKED_SUPER_ADMIN_PERMISSIONS = new Set(["admin:permissions", "admin:users"]);

const CREATOR_DEFAULTS = [
  "nav:dashboard",
  "nav:plans",
  "nav:agreements",
  "plan:create",
  "plan:view_own",
  "plan:view_department",
  "plan:report",
  "agreement:manage",
  "agreement:monitor",
  "ai:analyze",
];

const AUTHOR_ONLY = new Set(["plan:create", "plan:report", "agreement:manage"]);

/** Initial role → permission matrix, written to the DB by the seed. */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, string[]> = {
  // The administrator runs the system and does not go on trips, so the author-side work is left out.
  SUPER_ADMIN: PERMISSIONS.map((p) => p.key).filter((k) => !AUTHOR_ONLY.has(k)),
  TASDIQLOVCHI: [
    "nav:dashboard",
    "nav:plans",
    "nav:agreements",
    "plan:view_all",
    "plan:approve",
    "plan:remind_report",
    "agreement:monitor",
    "agreement:complete",
    "ai:analyze",
  ],
  ORINBOSAR: CREATOR_DEFAULTS,
  BOSHQARMA_BOSHLIGI: CREATOR_DEFAULTS,
  TUMAN_HOKIMI: CREATOR_DEFAULTS,
  KUZATUVCHI: ["nav:dashboard", "nav:plans", "nav:agreements", "plan:view_all"],
};

export type Override = { permission: string; state: OverrideState };

/**
 * Effective permissions: role defaults, then the department's overrides,
 * then the user's own overrides (the most specific level wins).
 */
export function resolvePermissions(
  roleDefaults: Iterable<string>,
  departmentOverrides: Override[],
  userOverrides: Override[],
): Set<string> {
  const result = new Set(roleDefaults);
  for (const level of [departmentOverrides, userOverrides]) {
    for (const o of level) {
      if (o.state === "GRANT") result.add(o.permission);
      else result.delete(o.permission);
    }
  }
  return result;
}
