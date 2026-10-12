import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { errorResponse, HttpError } from "@/lib/api";

const loginInput = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const { username, password } = loginInput.parse(await req.json());
    const user = await db.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, "Login yoki parol noto'g'ri");
    }
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await setSessionCookie(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
