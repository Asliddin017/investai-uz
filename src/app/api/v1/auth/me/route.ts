import { withUser } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/permissions";

export const GET = withUser(async ({ user }) => ({
  id: user.id,
  fullName: user.fullName,
  username: user.username,
  role: user.role,
  roleLabel: ROLE_LABELS[user.role],
  position: user.position,
  departmentId: user.departmentId,
  departmentName: user.departmentName,
  permissions: [...user.permissions],
}));
