import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";

type AuthErrorLike = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

function isInvalidRefreshTokenError(
  error: unknown,
) {
  if (
    !error ||
    typeof error !== "object"
  ) {
    return false;
  }

  const candidate =
    error as AuthErrorLike;

  const code =
    typeof candidate.code ===
    "string"
      ? candidate.code
      : "";

  const message =
    typeof candidate.message ===
    "string"
      ? candidate.message
          .toLowerCase()
      : "";

  return (
    code ===
      "refresh_token_not_found" ||
    code ===
      "refresh_token_already_used" ||
    message.includes(
      "refresh token not found",
    ) ||
    message.includes(
      "invalid refresh token",
    )
  );
}

function authCookiePrefix(
  supabaseUrl: string,
) {
  const hostname =
    new URL(
      supabaseUrl,
    ).hostname;

  const projectRef =
    hostname.split(".")[0];

  return `sb-${projectRef}-auth-token`;
}

export async function updateSession(
  request: NextRequest,
) {
  let response =
    NextResponse.next({
      request,
    });

  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const publishableKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return response;
  }

  const supabase =
    createServerClient(
      url,
      publishableKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(
            cookiesToSet,
          ) {
            cookiesToSet.forEach(
              ({
                name,
                value,
              }) => {
                request.cookies.set(
                  name,
                  value,
                );
              },
            );

            response =
              NextResponse.next({
                request,
              });

            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                response.cookies.set(
                  name,
                  value,
                  options,
                );
              },
            );
          },
        },
      },
    );

  let claimsError:
    unknown = null;

  try {
    const {
      error,
    } =
      await supabase.auth
        .getClaims();

    claimsError = error;
  } catch (error) {
    claimsError = error;
  }

  if (claimsError) {
    if (
      isInvalidRefreshTokenError(
        claimsError,
      )
    ) {
      const prefix =
        authCookiePrefix(url);

      const staleCookieNames =
        request.cookies
          .getAll()
          .map(
            (cookie) =>
              cookie.name,
          )
          .filter(
            (name) =>
              name.startsWith(
                prefix,
              ),
          );

      /*
       * Remove stale auth cookies from
       * the request passed to Server
       * Components.
       */
      for (
        const name of
        staleCookieNames
      ) {
        request.cookies.delete(
          name,
        );
      }

      const cleanResponse =
        NextResponse.next({
          request,
        });

      /*
       * Also tell the browser to discard
       * the same invalid cookies.
       */
      for (
        const name of
        staleCookieNames
      ) {
        cleanResponse.cookies.delete(
          name,
        );
      }

      cleanResponse.headers.set(
        "Cache-Control",
        "private, no-store",
      );

      console.warn(
        "Cleared stale Supabase auth cookies.",
      );

      return cleanResponse;
    }

    /*
     * Unexpected auth failures should
     * remain visible instead of being
     * silently treated as logout.
     */
    throw claimsError;
  }

  response.headers.set(
    "Cache-Control",
    "private, no-store",
  );

  return response;
}
