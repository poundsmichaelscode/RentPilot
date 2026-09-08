import type {
  NextFunction,
  Request,
  Response,
} from "express";

import type {
  OrganisationRole,
} from "../types/organisation.js";

export function requireRole(
  ...allowedRoles: OrganisationRole[]
) {
  return function organisationRoleMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    if (!req.membership) {
      return res.status(403).json({
        success: false,
        error: {
          code: "ORGANISATION_REQUIRED",
          message:
            "Organisation membership is required.",
        },
      });
    }

    if (!allowedRoles.includes(req.membership.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "INSUFFICIENT_PERMISSION",
          message:
            "You do not have permission to perform this action.",
        },
      });
    }

    return next();
  };
}
