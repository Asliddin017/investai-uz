import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, type CurrentUser } from "./auth";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = () => new HttpError(401, "Tizimga kirish talab qilinadi");
export const forbidden = (msg = "Bu amal uchun ruxsat yo'q") => new HttpError(403, msg);
export const notFound = (msg = "Topilmadi") => new HttpError(404, msg);
export const badRequest = (msg: string) => new HttpError(400, msg);

export function requirePermission(user: CurrentUser, ...anyOf: string[]) {
  if (!anyOf.some((p) => user.permissions.has(p))) throw forbidden();
}

type Handler<P> = (ctx: { req: Request; user: CurrentUser; params: P }) => Promise<unknown>;

/** Wraps a route handler: loads the session user, maps errors to JSON responses. */
export function withUser<P = Record<string, string>>(handler: Handler<P>) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      const user = await getCurrentUser();
      if (!user) throw unauthorized();
      const result = await handler({ req, user, params: await ctx.params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const where = first?.path.length ? `${first.path.join(".")}: ` : "";
    return NextResponse.json({ error: `${where}${first?.message ?? "Noto'g'ri ma'lumot"}` }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: "Serverda xatolik yuz berdi" }, { status: 500 });
}
