import { Router } from "express";

import { supabase } from "../config/supabase.js";

const router = Router();

router.get("/current", async (req, res, next) => {
  try {
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

    const { data, error } = await supabase
      .from("organisations")
      .select(
        "id,name,slug,country_code,default_currency,timezone,status,created_at",
      )
      .eq(
        "id",
        req.membership.organisationId,
      )
      .single();

    if (error) {
      return next(error);
    }

    return res.json({
      success: true,
      data: {
        organisation: data,
        membership: {
          id: req.membership.membershipId,
          role: req.membership.role,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
