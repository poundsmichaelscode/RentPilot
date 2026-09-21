import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  createClient,
} from "../../lib/supabase/server";

/*
 * Signing out changes authentication state.
 * Never perform this operation from GET.
 */
export async function POST(
  request: NextRequest,
) {
  const supabase =
    await createClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(
    new URL(
      "/login",
      request.url,
    ),
    {
      status: 303,
    },
  );
}

/*
 * A direct browser visit to /logout must
 * never destroy the user's session.
 */
export async function GET(
  request: NextRequest,
) {
  return NextResponse.redirect(
    new URL(
      "/dashboard",
      request.url,
    ),
    {
      status: 303,
    },
  );
}
