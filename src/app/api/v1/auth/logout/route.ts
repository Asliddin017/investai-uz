import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (user) {
    await audit(user, { action: "auth.logout", entityType: "user", entityId: user.id, summary: "Tizimdan chiqdi" }, req);
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
