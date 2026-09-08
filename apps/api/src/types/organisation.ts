export const ORGANISATION_ROLES = [
  "OWNER",
  "ADMIN",
  "PROPERTY_MANAGER",
  "ACCOUNTANT",
  "STAFF",
] as const;

export type OrganisationRole =
  (typeof ORGANISATION_ROLES)[number];

export interface OrganisationMembership {
  membershipId: string;
  organisationId: string;
  role: OrganisationRole;
}
