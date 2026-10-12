import { db } from "@/lib/db";
import { withUser } from "@/lib/api";
import { setThemeCookie } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import { profileInput } from "@/lib/schemas";

/**
 * Every signed-in user edits their own position and theme. Full name, login, role and organization
 * stay admin-only: the name is what approval history shows, so a user must not be able to change it.
 */
export const GET = withUser(async ({ user }) => ({
  fullName: user.fullName,
  username: user.username,
  position: user.position,
  roleLabel: ROLE_LABELS[user.role],
  departmentName: user.departmentName,
  theme: user.theme,
}));

export const PUT = withUser(async ({ req, user }) => {
  const data = profileInput.parse(await req.json());
  await db.user.update({
    where: { id: user.id },
    data: { position: data.position, theme: data.theme },
  });
  await setThemeCookie(data.theme);
  return { ok: true };
});
