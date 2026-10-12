import { db } from "@/lib/db";
import { withUser } from "@/lib/api";
import { assertNameNotTaken } from "@/lib/name-requests";
import { setThemeCookie } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import { profileInput } from "@/lib/schemas";
import { audit } from "@/lib/audit";

/**
 * Every signed-in user edits their own position and theme. The full name is what approval history
 * shows, so it changes only through a request an administrator approves (see name-requests);
 * login, role and organization stay admin-only.
 */
export const GET = withUser(async ({ user }) => ({
  nameRequests: await db.nameChangeRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      oldName: true,
      newName: true,
      reason: true,
      status: true,
      reviewComment: true,
      createdAt: true,
      reviewedAt: true,
      reviewer: { select: { fullName: true, username: true } },
    },
  }),
  fullName: user.fullName,
  username: user.username,
  position: user.position,
  roleLabel: ROLE_LABELS[user.role],
  departmentName: user.departmentName,
  theme: user.theme,
  canRenameSelf: user.permissions.has("admin:users"),
  mustChangePassword: user.mustChangePassword,
}));

export const PUT = withUser(async ({ req, user }) => {
  const data = profileInput.parse(await req.json());
  // An administrator would only be approving their own request, so they rename themselves directly.
  const rename =
    data.fullName && data.fullName !== user.fullName && user.permissions.has("admin:users") ? data.fullName : null;
  if (rename) await assertNameNotTaken(db, user.id, rename);
  await db.user.update({
    where: { id: user.id },
    data: { position: data.position, theme: data.theme, ...(rename ? { fullName: rename } : {}) },
  });
  await audit(user, { action: "profile.update", entityType: "user", entityId: user.id, summary: `${rename ? `Ism: ${user.fullName} → ${rename}; ` : ""}Lavozim: ${data.position ?? "—"}, rejim: ${data.theme}` }, req);
  await setThemeCookie(data.theme);
  return { ok: true };
});
