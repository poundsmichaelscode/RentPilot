import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "../../../lib/supabase/server";

function safeNext(
  value: string | null,
) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/onboarding";
  }

  return value;
}

export async function GET(
  request: Request,
) {
  const url = new URL(request.url);

  const code =
    url.searchParams.get("code");

  const next =
    safeNext(
      url.searchParams.get("next"),
    );

  if (code) {
    const supabase =
      await createClient();

    const { error } =
      await supabase.auth
        .exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(
        new URL(next, url.origin),
      );
    }
  }

  return NextResponse.redirect(
    new URL(
      "/login?error=confirmation_failed",
      url.origin,
    ),
  );
}
