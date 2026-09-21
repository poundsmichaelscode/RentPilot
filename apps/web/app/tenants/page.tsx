import {
  requireRentPilotUser,
} from "../auth";

import TenantList from "./tenant-list";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRentPilotUser(
    "/tenants",
  );

  return <TenantList />;
}
