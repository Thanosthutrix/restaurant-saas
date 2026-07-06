import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isStaleAuthSessionError } from "@/lib/supabase/authErrors";

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

function isConsumerAccountPath(pathname: string) {
  if (pathname === "/compte/connexion" || pathname === "/compte/inscription") return false;
  return pathname === "/compte" || pathname.startsWith("/compte/");
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => {
    const name = cookie.name;
    return name.startsWith("sb-") && name.includes("auth-token") && cookie.value.length > 0;
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let authenticated = hasSupabaseAuthCookie(request);

  if (authenticated && url && anonKey) {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error && isStaleAuthSessionError(error)) {
      await supabase.auth.signOut();
      authenticated = false;
      if (isProtected(pathname)) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", "session_expiree");
        return NextResponse.redirect(loginUrl);
      }
    } else {
      authenticated = Boolean(user);
    }
  }

  if (isProtected(pathname) && !authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isConsumerAccountPath(pathname) && !authenticated) {
    const loginUrl = new URL("/compte/connexion", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
