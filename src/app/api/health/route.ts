import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/health — Docker HEALTHCHECK and deploy smoke test: app is up and the database answers. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: true });
  } catch (err) {
    console.error("[health] DB check failed:", err);
    return NextResponse.json({ ok: false, db: false }, { status: 503 });
  }
}
