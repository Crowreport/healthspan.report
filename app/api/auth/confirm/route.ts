import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  // Handle OAuth code exchange (Google, etc.)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const user = data.user;
      const fullName = user.user_metadata?.full_name as string | undefined;
      const firstName = fullName?.split(" ")[0] ?? "";
      const lastName = fullName?.split(" ").slice(1).join(" ") ?? "";
      const username = firstName.toLowerCase() || user.email?.split("@")[0] || "user";

      await supabase.from("users").upsert(
        {
          id: user.id,
          email: user.email,
          first_name: firstName || null,
          last_name: lastName || null,
          username: username,
          role: "member",
        },
        { onConflict: "id" }
      );

      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(`${origin}/login?message=oauth-error`);
  }

  // Handle email OTP verification
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}/login?message=email-verified`);
    }
  }

  return NextResponse.redirect(`${origin}/login?message=verification-error`);
}