import { requireRentPilotUser } from "../auth";
import DocumentLibrary from "./document-library";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRentPilotUser("/documents");

  return <DocumentLibrary />;
}
