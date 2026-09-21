import { requireRentPilotUser } from "../auth";
import MaintenanceList from "./maintenance-list";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRentPilotUser("/maintenance");

  return <MaintenanceList />;
}
