import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "sb_access_token";

export function middleware(request: NextRequest) {
  if (request.cookies.get(TOKEN_COOKIE)?.value) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;
  const login = request.nextUrl.clone();
  login.pathname = "/auth/login";
  login.search = "";
  login.searchParams.set(
    "role",
    pathname.startsWith("/dashboard/clinic") ? "clinic" : "client",
  );
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
