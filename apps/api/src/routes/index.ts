import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { requireOrganisation } from "../middleware/require-organisation.js";

import marketplace from "./marketplace.js";
import organisations from "./organisations.js";
import properties from "./properties.js";
import resources from "./resources.js";

export const api = Router();

/*
 * Public routes
 */
api.use("/marketplace", marketplace);

/*
 * Organisation-aware SaaS routes
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

/*
 * Legacy authenticated routes.
 *
 * These still use landlord_id / tenant_id internally.
 * Keep them working until each domain is migrated.
 */
api.use("/", requireAuth, resources);
