import { requireRentPilotUser } from "../auth";
import PaymentList from "./payment-list";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRentPilotUser("/payments");

  return <PaymentList />;
}
