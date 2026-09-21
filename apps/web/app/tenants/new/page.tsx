import {
  requireRentPilotUser,
} from "../../auth";

import TenantForm from "./tenant-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRentPilotUser(
    "/tenants/new",
  );

  return <TenantForm />;
}
