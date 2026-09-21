import { redirect } from "next/navigation";

import {
  requireRentPilotUser,
} from "../auth";

import {
  createClient,
} from "../../lib/supabase/server";

import Dashboard from "./dashboard";
import TenantDashboard from "./tenant-dashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user =
    await requireRentPilotUser(
      "/dashboard",
    );

  const supabase =
    await createClient();

  /*
   * profiles.role is the account role.
   * Query-string role values are never used for
   * authorization or dashboard selection.
   */
  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(
      `
      id,
      role
      `,
    )
    .eq(
      "id",
      user.id,
    )
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    redirect("/login");
  }

  if (
    profile.role === "tenant"
  ) {
    return (
      <TenantDashboard
        user={user}
        signOut="/logout"
      />
    );
  }

  /*
   * Landlords/managers operate inside an
   * organisation workspace.
   */
  const {
    data: memberships,
    error:
      membershipError,
  } = await supabase
    .from(
      "organisation_members",
    )
    .select("id,role")
    .eq(
      "user_id",
      user.id,
    )
    .eq(
      "is_active",
      true,
    )
    .limit(1);

  if (membershipError) {
    throw membershipError;
  }

  if (!memberships?.length) {
    redirect("/onboarding");
  }

  return (
    <Dashboard
      user={user}
      signOut="/logout"
      initialRole={
        memberships[0].role
      }
    />
  );
}
