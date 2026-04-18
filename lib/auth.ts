"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export interface CurrentUser {
  id: string;
  email: string | null;
  role: string;
}

/**
 * Get the current authenticated user and their role from public.users.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", authUser.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    email: authUser.email ?? null,
    role: profile.role ?? "member",
  };
}

/**
 * Require admin. Redirects to /login if not authenticated, or shows 403 if not admin.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "admin") {
    redirect("/");
  }
  return user;
}
