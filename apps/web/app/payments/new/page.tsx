import { requireRentPilotUser } from "../../auth";
import PaymentForm from "./payment-form";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    chargeId?: string;
  }>;
}) {
  await requireRentPilotUser("/payments/new");

  const query = await searchParams;

  return (
    <PaymentForm
      initialChargeId={query.chargeId ?? ""}
    />
  );
}
