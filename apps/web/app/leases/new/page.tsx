import {
  requireRentPilotUser,
} from "../../auth";

import LeaseForm from "./lease-form";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    tenantId?: string;
    unitId?: string;
  }>;
}) {
  await requireRentPilotUser(
    "/leases/new",
  );

  const query = await searchParams;

  return (
    <LeaseForm
      initialTenantId={
        query.tenantId ?? ""
      }
      initialUnitId={
        query.unitId ?? ""
      }
    />
  );
}
