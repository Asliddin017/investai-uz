import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "investai_session";

/** Cheap gate for pages: no cookie → login. The real session check runs in the layout and API. */
export function middleware(req: NextRequest) {
  if (!req.cookies.get(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|_next|favicon.ico).*)"],
};
