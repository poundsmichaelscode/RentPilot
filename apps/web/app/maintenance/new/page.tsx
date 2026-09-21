import { requireRentPilotUser } from "../../auth";
import MaintenanceForm from "./maintenance-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRentPilotUser(
    "/maintenance/new",
  );

  return <MaintenanceForm />;
}
