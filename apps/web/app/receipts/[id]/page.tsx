import { requireRentPilotUser } from "../../auth";
import ReceiptDetail from "./receipt-detail";

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
    `/receipts/${id}`,
  );

  return <ReceiptDetail receiptId={id} />;
}
