import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = [
  "/dashboard",
  "/service",
  "/dishes",
  "/inventory",
  "/preparations",
  "/sales",
  "/ticket-import",
  "/onboarding",
  "/account",
  "/hygiene",
];

function isProtected(pathname: string) {
  return protectedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => {
    const name = cookie.name;
    return name.startsWith("sb-") && name.includes("auth-token") && cookie.value.length > 0;
  });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const probablyAuthenticated = hasSupabaseAuthCookie(request);

  if (isProtected(pathname) && !probablyAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/" && probablyAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
