import { db } from "@/lib/db";
import { withUser } from "@/lib/api";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { passwordChangeInput } from "@/lib/schemas";

/**
 * A signed-in user sets a new password without re-entering the old one (as requested).
 * Every other session is signed out, this one gets a fresh token, and the change is logged.
 */
export const PUT = withUser(async ({ req, user }) => {
  const { newPassword } = passwordChangeInput.parse(await req.json());
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      sessionVersion: { increment: 1 },
      mustChangePassword: false,
    },
  });
  await setSessionCookie(user.id, updated.sessionVersion);
  await audit(user, { action: "profile.password_change", entityType: "user", entityId: user.id, summary: "Parolini o'zgartirdi" }, req);
  return { ok: true };
});
