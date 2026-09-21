import {
  requireRentPilotUser,
} from "../auth";

import LeaseList from "./lease-list";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRentPilotUser(
    "/leases",
  );

  return <LeaseList />;
}
