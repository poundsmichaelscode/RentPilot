import {
  redirect,
} from "next/navigation";

import {
  requireRentPilotUser,
} from "../auth";

import {
  createClient,
} from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user =
    await requireRentPilotUser(
      "/dashboard",
    );

  const supabase =
    await createClient();

  const {
    data: profile,
    error,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (
    !profile ||
    profile.role !== "tenant"
  ) {
    redirect("/dashboard");
  }

  return children;
}
