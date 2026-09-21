import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "../../../lib/supabase/server";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

export async function POST(
  request: Request,
) {
  try {
    const body =
      (await request.json()) as LoginBody;

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Email and password are required.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control":
              "private, no-store",
          },
        },
      );
    }

    const supabase =
      await createClient();

    const {
      data,
      error,
    } =
      await supabase.auth
        .signInWithPassword({
          email,
          password,
        });

    if (
      error ||
      !data.user ||
      !data.session
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            error?.message ??
            "Unable to sign in.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control":
              "private, no-store",
          },
        },
      );
    }

    return NextResponse.json(
      {
        success: true,

        user: {
          id: data.user.id,
          email:
            data.user.email,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to process sign in.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  }
}
