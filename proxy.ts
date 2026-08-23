import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isStaleAuthSessionError } from "@/lib/supabase/authErrors";
import { isProSpacePathForAdminRedirect } from "@/lib/auth/postLoginPath";

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
  "/settings",
  "/hygiene",
  "/admin",
];

function isProtected(pathname: string) {
  return protectedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isConsumerAccountPath(pathname: string) {
  if (pathname === "/compte/connexion" || pathname === "/compte/inscription") return false;
  return pathname === "/compte" || pathname.startsWith("/compte/");
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => {
    const name = cookie.name;
    return name.startsWith("sb-") && name.includes("auth-token") && cookie.value.length > 0;
  });
}

async function isPlatformAdminUser(userId: string, email: string | null): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim() || "medhi.thuleau@gmail.com";
  if (email === adminEmail) return true;

  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!supabaseUrl || !serviceKey) return false;

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data } = await adminClient
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let authenticated = hasSupabaseAuthCookie(request);
  let userEmail: string | null = null;
  let userId: string | null = null;

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
      userEmail = user?.email ?? null;
      userId = user?.id ?? null;
    }
  }

  const needsAdminCheck =
    isAdminPath(pathname) || (authenticated && isProSpacePathForAdminRedirect(pathname));

  let isAdmin = false;
  if (authenticated && userId && needsAdminCheck) {
    isAdmin = await isPlatformAdminUser(userId, userEmail);
  }

  if (isAdmin && isProSpacePathForAdminRedirect(pathname)) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (isAdminPath(pathname)) {
    if (!authenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (isProtected(pathname) && !isAdminPath(pathname) && !authenticated) {
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
