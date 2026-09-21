import { requireRentPilotUser } from "../../auth";
import PropertyDetail from "./property-detail";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  await requireRentPilotUser(
    `/properties/${id}`,
  );

  return <PropertyDetail propertyId={id} />;
}
