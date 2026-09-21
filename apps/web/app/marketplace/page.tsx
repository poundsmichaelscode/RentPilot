import Marketplace from "./marketplace";

export const dynamic =
  "force-dynamic";

export const metadata = {
  title:
    "Properties for Rent | RentPilot",

  description:
    "Browse available rental properties and vacant units listed on RentPilot.",
};

export default function Page() {
  return <Marketplace />;
}
