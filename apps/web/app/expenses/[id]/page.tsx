import {
  requireRentPilotUser,
} from "../../auth";

import ExpenseDetail from "./expense-detail";

export const dynamic =
  "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function Page({
  params,
}: PageProps) {
  await requireRentPilotUser(
    "/expenses",
  );

  const {
    id,
  } = await params;

  return (
    <ExpenseDetail
      expenseId={id}
    />
  );
}
