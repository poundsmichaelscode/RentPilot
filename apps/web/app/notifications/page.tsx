import {
  redirect,
} from "next/navigation";

import {
  requireRentPilotUser,
} from "../auth";

import {
  createClient,
} from "../../lib/supabase/server";

import NotificationCenter from "./notification-center";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user =
    await requireRentPilotUser(
      "/notifications",
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

  if (!profile) {
    redirect("/login");
  }

  return (
    <NotificationCenter
      role={profile.role}
    />
  );
}
