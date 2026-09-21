import { createClient } from "./supabase/client";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new ApiError(
      "Authentication is required.",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const headers = new Headers(init.headers);

  headers.set(
    "Authorization",
    `Bearer ${session.access_token}`,
  );

  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  const response = await fetch(
    `/api${path}`,
    {
      ...init,
      headers,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    let body: ApiErrorBody = {};

    try {
      body =
        (await response.json()) as ApiErrorBody;
    } catch {
      // Ignore malformed error responses.
    }

    throw new ApiError(
      body.error?.message ??
        body.message ??
        "Request failed.",
      response.status,
      body.error?.code,
    );
  }

  return response.json() as Promise<T>;
}

export async function apiDownload(
  path: string,
  filename: string,
): Promise<void> {
  const supabase =
    createClient();

  const {
    data: {
      session,
    },
  } =
    await supabase.auth
      .getSession();

  if (
    !session?.access_token
  ) {
    throw new ApiError(
      "Authentication is required.",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const response =
    await fetch(
      `/api${path}`,
      {
        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
        },

        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    let body:
      ApiErrorBody = {};

    try {
      body =
        (await response.json()) as
          ApiErrorBody;
    } catch {
      // Ignore malformed error payloads.
    }

    throw new ApiError(
      body.error?.message ??
        body.message ??
        "Download failed.",

      response.status,

      body.error?.code,
    );
  }

  const blob =
    await response.blob();

  const objectUrl =
    URL.createObjectURL(
      blob,
    );

  const link =
    document.createElement(
      "a",
    );

  link.href =
    objectUrl;

  link.download =
    filename;

  document.body
    .appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(
    objectUrl,
  );
}
