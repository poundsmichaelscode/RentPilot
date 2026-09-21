import { requireRentPilotUser } from "../../auth";
import DocumentUploadForm from "./document-upload-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRentPilotUser(
    "/documents/new",
  );

  return <DocumentUploadForm />;
}
