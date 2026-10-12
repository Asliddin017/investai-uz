import { db } from "@/lib/db";
import { badRequest, withUser } from "@/lib/api";
import { setThemeCookie } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import { profileInput } from "@/lib/schemas";

/** Every signed-in user edits their own display data; login, role and organization stay admin-only. */
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
  // A name already worn by another account would let approvals and history read as someone else.
  const clash = await db.user.findFirst({
    where: { id: { not: user.id }, fullName: { equals: data.fullName, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) throw badRequest("Bu F.I.Sh. boshqa xodimga tegishli");
  await db.user.update({
    where: { id: user.id },
    data: { fullName: data.fullName, position: data.position, theme: data.theme },
  });
  await setThemeCookie(data.theme);
  return { ok: true };
});
