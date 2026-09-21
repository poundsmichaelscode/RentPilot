import {
  requireRentPilotUser,
} from "../auth";

import ExpensesDashboard from "./expenses-dashboard";

export const dynamic =
  "force-dynamic";

export default async function Page() {
  await requireRentPilotUser(
    "/expenses",
  );

  return <ExpensesDashboard />;
}
