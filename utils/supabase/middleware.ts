import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/admin", "/library", "/settings"];
const ADMIN_ROUTES = ["/admin", "/api/admin"];
const API_ROUTES = ["/api/"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Securely get the user from Supabase auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Check if current path matches any of the protected routes
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));
  const isApiRoute = API_ROUTES.some((route) => pathname.startsWith(route));

  if (!user && (isProtected || isAdminRoute)) {
    // Unauthorized API requests should get a 401 JSON response
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Unauthorized UI requests redirect to login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname); // Optional: remember where they were going
    return NextResponse.redirect(url);
  }

  if (user && isAdminRoute) {
    // For admin routes, we must verify the user's role in the database
    // as relying on user_metadata alone can sometimes be bypassed or out of sync.
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userData?.role !== "admin") {
      if (isApiRoute) {
        return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
      }
      // Redirect non-admins trying to access admin pages to the homepage
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
