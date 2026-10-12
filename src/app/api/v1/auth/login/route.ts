import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { setSessionCookie, setThemeCookie, verifyPassword } from "@/lib/auth";
import { errorResponse, HttpError } from "@/lib/api";
import { audit } from "@/lib/audit";

const loginInput = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const { username, password } = loginInput.parse(await req.json());
    const user = await db.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
      await audit(
        // Never log raw input for unknown accounts: people sometimes type their password into the login field.
        user ? { id: user.id, fullName: user.fullName, username: user.username } : { label: "noma'lum login" },
        {
          action: "auth.login_failed",
          entityType: "user",
          entityId: user?.id,
          summary: user ? `Noto'g'ri parol yoki faol bo'lmagan hisob: @${user.username}` : "Mavjud bo'lmagan login bilan urinish",
        },
        req,
      );
      throw new HttpError(401, "Login yoki parol noto'g'ri");
    }
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await setSessionCookie(user.id, user.sessionVersion);
    await setThemeCookie(user.theme);
    await audit(user, { action: "auth.login", entityType: "user", entityId: user.id, summary: "Tizimga kirdi" }, req);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
