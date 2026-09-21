import {
  requireRentPilotUser,
} from "../auth";

import AuditLog from "./audit-log";

export const dynamic =
  "force-dynamic";

export default async function Page() {
  await requireRentPilotUser(
    "/audit-log",
  );

  return <AuditLog />;
}
