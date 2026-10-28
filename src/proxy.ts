import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Sign-in/up and the credits page ("Hakkında": data sources, attribution) need no account.
const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/about"];
// A single personal list (and its link preview image): public lists open without an account,
// the page itself decides what a visitor may see.
const PUBLIC_LIST = /^\/lists\/[0-9a-f-]{36}(\/.*)?$/i;

// Optimistic check only (cookie present?) so signed-out visitors are redirected before any
// rendering. Real authorization happens in the Data Access Layer (requireUser).
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) || PUBLIC_LIST.test(pathname)) {
    return NextResponse.next();
  }
  if (!getSessionCookie(request)) {
    const signIn = new URL("/sign-in", request.url);
    if (pathname !== "/") signIn.searchParams.set("next", pathname + search);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
