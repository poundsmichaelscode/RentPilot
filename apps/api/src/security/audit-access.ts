const auditViewerRoles =
  new Set([
    "OWNER",
    "ADMIN",
  ]);

export function canViewAuditLog(
  role:
    | string
    | null
    | undefined,
) {
  return Boolean(
    role &&
      auditViewerRoles.has(
        role,
      ),
  );
}
