import MarketplaceDetail from "./marketplace-detail";

export const dynamic =
  "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const {
    id,
  } = await params;

  return (
    <MarketplaceDetail
      propertyId={id}
    />
  );
}
