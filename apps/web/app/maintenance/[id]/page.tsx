import { requireRentPilotUser } from "../../auth";
import MaintenanceDetail from "./maintenance-detail";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  await requireRentPilotUser(
    `/maintenance/${id}`,
  );

  return (
    <MaintenanceDetail
      maintenanceId={id}
    />
  );
}
