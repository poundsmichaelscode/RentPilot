import {
  requireRentPilotUser,
} from "../../auth";

import PropertySetupForm from "./property-setup-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRentPilotUser(
    "/properties/new",
  );

  return <PropertySetupForm />;
}
