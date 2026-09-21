import {
  requireRentPilotUser,
} from "../auth";

import FinancialReports from "./financial-reports";

export const dynamic =
  "force-dynamic";

export default async function Page() {
  await requireRentPilotUser(
    "/reports",
  );

  return <FinancialReports />;
}
