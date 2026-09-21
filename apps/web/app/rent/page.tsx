import { requireRentPilotUser } from "../auth";
import RentDashboard from "./rent-dashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRentPilotUser("/rent");

  return <RentDashboard />;
}
