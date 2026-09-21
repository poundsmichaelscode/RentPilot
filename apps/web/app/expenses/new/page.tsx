import {
  requireRentPilotUser,
} from "../../auth";

import ExpenseForm from "./expense-form";

export const dynamic =
  "force-dynamic";

export default async function Page() {
  await requireRentPilotUser(
    "/expenses/new",
  );

  return <ExpenseForm />;
}
