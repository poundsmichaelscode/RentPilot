import { redirect } from "next/navigation";

import {
  createClient,
} from "../lib/supabase/server";

export type RentPilotUser = {
  id: string;
  email: string;
  fullName: string | null;
  displayName: string;
};

export async function getRentPilotUser():
  Promise<RentPilotUser | null> {

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase.auth.getUser();

  if (
    error ||
    !data.user ||
    !data.user.email
  ) {
    return null;
  }

  const fullName =
    typeof data.user.user_metadata
      ?.full_name === "string"
      ? data.user.user_metadata.full_name
      : null;

  return {
    id: data.user.id,
    email: data.user.email,
    fullName,

    displayName:
      fullName ??
      data.user.email,
  };
}

export async function requireRentPilotUser(
  returnTo = "/dashboard",
) {
  const user =
    await getRentPilotUser();

  if (!user) {
    redirect(
      `/login?return_to=${encodeURIComponent(
        returnTo,
      )}`,
    );
  }

  return user;
}
