import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { supabase } from "../config/supabase.js";
import type {
  OrganisationMembership,
  OrganisationRole,
} from "../types/organisation.js";

declare global {
  namespace Express {
    interface Request {
      membership?: OrganisationMembership;
    }
  }
}

type MembershipRow = {
  id: string;
  organisation_id: string;
  role: OrganisationRole;
  is_active: boolean;
};

export async function requireOrganisation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "Authentication is required.",
        },
      });
    }

    const requestedOrganisationId =
      req.header("x-organisation-id")?.trim();

    let query = supabase
      .from("organisation_members")
      .select("id,organisation_id,role,is_active")
      .eq("user_id", req.user.id)
      .eq("is_active", true);

    if (requestedOrganisationId) {
      query = query.eq(
        "organisation_id",
        requestedOrganisationId,
      );
    }

    const { data, error } = await query.limit(2);

    if (error) {
      return next(error);
    }

    const memberships =
      (data ?? []) as MembershipRow[];

    if (memberships.length === 0) {
      return res.status(403).json({
        success: false,
        error: {
          code: "ORGANISATION_ACCESS_DENIED",
          message:
            "You do not have access to this organisation.",
        },
      });
    }

    if (
      !requestedOrganisationId &&
      memberships.length > 1
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "ORGANISATION_REQUIRED",
          message:
            "Select an organisation before continuing.",
        },
      });
    }

    const membership = memberships[0];

    req.membership = {
      membershipId: membership.id,
      organisationId: membership.organisation_id,
      role: membership.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
