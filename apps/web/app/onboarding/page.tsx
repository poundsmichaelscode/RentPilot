import { requireRentPilotUser } from "../auth";
import OnboardingForm from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  await requireRentPilotUser("/onboarding");

  return <OnboardingForm />;
}
