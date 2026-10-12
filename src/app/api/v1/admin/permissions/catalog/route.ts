import { requirePermission, withUser } from "@/lib/api";
import { CATEGORY_LABELS, CATEGORY_ORDER, PERMISSIONS, ROLES } from "@/lib/permissions";

export const GET = withUser(async ({ user }) => {
  requirePermission(user, "admin:permissions");
  return {
    permissions: PERMISSIONS,
    categories: CATEGORY_ORDER.map((key) => ({ key, label: CATEGORY_LABELS[key] })),
    roles: ROLES,
  };
});
