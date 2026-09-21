import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { requireOrganisation } from "../middleware/require-organisation.js";

import marketplace from "./marketplace.js";
import organisations from "./organisations.js";
import onboarding from "./onboarding.js";
import tenantPortal from "./tenant-portal.js";
import tenantActions from "./tenant-actions.js";
import notifications from "./notifications.js";
import auditLogs from "./audit-logs.js";
import properties from "./properties.js";
import units from "./units.js";
import tenants from "./tenants.js";
import leases from "./leases.js";
import rentCharges from "./rent-charges.js";
import rentPayments from "./rent-payments.js";
import receipts from "./receipts.js";
import maintenance from "./maintenance.js";
import documents from "./documents.js";
import resources from "./resources.js";

export const api = Router();

/*
 * Public routes.
 */
api.use("/marketplace", marketplace);

/*
 * Authenticated onboarding.
 *
 * Organisation membership is intentionally not required because
 * this flow creates the user's first organisation membership.
 */
api.use("/onboarding", requireAuth, onboarding);

/*
 * Tenant portal.
 *
 * Tenant access is derived from profiles.role and
 * tenants.profile_id rather than organisation membership.
 */
api.use(
  "/tenant-portal",
  requireAuth,
  tenantPortal,
);

api.use(
  "/tenant-portal",
  requireAuth,
  tenantActions,
);

/*
 * Organisation-aware SaaS routes.
 */
api.use(
  "/organisations",
  requireAuth,
  requireOrganisation,
  organisations,
);

api.use(
  "/properties",
  requireAuth,
  requireOrganisation,
  properties,
);

api.use(
  "/units",
  requireAuth,
  requireOrganisation,
  units,
);

api.use(
  "/tenants",
  requireAuth,
  requireOrganisation,
  tenants,
);

api.use(
  "/leases",
  requireAuth,
  requireOrganisation,
  leases,
);

api.use(
  "/rent-charges",
  requireAuth,
  requireOrganisation,
  rentCharges,
);

api.use(
  "/rent-payments",
  requireAuth,
  requireOrganisation,
  rentPayments,
);

api.use(
  "/receipts",
  requireAuth,
  requireOrganisation,
  receipts,
);


api.use(
  "/maintenance",
  requireAuth,
  requireOrganisation,
  maintenance,
);

api.use(
  "/documents",
  requireAuth,
  requireOrganisation,
  documents,
);

/*
 * Legacy authenticated routes.
 *
 * Keep only while remaining legacy domains are migrated.
 * Legacy financial mutations will be retired after verification.
 */
api.use(
  "/audit-logs",
  requireAuth,
  requireOrganisation,
  auditLogs,
);


api.use("/", requireAuth, resources);

api.use(
  "/notifications",
  requireAuth,
  notifications,
);
