import { db } from "@/lib/db";
import { withUser } from "@/lib/api";
import { setThemeCookie } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import { profileInput } from "@/lib/schemas";

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
