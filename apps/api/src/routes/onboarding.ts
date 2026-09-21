import { Router } from "express";
import { z } from "zod";

import { supabase } from "../config/supabase.js";

const router = Router();

const landlordOnboardingSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2)
    .max(120),

  organisationName: z
    .string()
    .trim()
    .min(2)
    .max(120),

  phone: z
    .string()
    .trim()
    .max(30)
    .default(""),

  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((value) =>
      value.toUpperCase(),
    )
    .default("NG"),

  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) =>
      value.toUpperCase(),
    )
    .default("NGN"),
});

router.get(
  "/status",
  async (req, res, next) => {
    try {
      const userId = req.user!.id;

      const [
        profileResult,
        membershipResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id,email,full_name,phone",
          )
          .eq("id", userId)
          .maybeSingle(),

        supabase
          .from("organisation_members")
          .select(
            `
            id,
            organisation_id,
            role,
            is_active,
            organisations (
              id,
              name,
              slug,
              status
            )
            `,
          )
          .eq("user_id", userId)
          .eq("is_active", true),
      ]);

      if (profileResult.error) {
        return next(
          profileResult.error,
        );
      }

      if (membershipResult.error) {
        return next(
          membershipResult.error,
        );
      }

      const memberships =
        membershipResult.data ?? [];

      return res.json({
        success: true,

        data: {
          onboarded:
            memberships.length > 0,

          profile:
            profileResult.data,

          memberships,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/landlord",
  async (req, res, next) => {
    try {
      const input =
        landlordOnboardingSchema.parse(
          req.body,
        );

      const email = req.user!.email;

      if (!email) {
        return res.status(400).json({
          success: false,

          error: {
            code: "EMAIL_REQUIRED",
            message:
              "Your authenticated account does not have an email address.",
          },
        });
      }

      const {
        data,
        error,
      } = await supabase.rpc(
        "complete_landlord_onboarding",
        {
          p_user_id:
            req.user!.id,

          p_email:
            email,

          p_full_name:
            input.fullName,

          p_phone:
            input.phone,

          p_organisation_name:
            input.organisationName,

          p_country_code:
            input.countryCode,

          p_default_currency:
            input.currency,
        },
      );

      if (error) {
        return next(error);
      }

      const result =
        Array.isArray(data)
          ? data[0]
          : data;

      if (!result) {
        throw new Error(
          "Onboarding did not return a result.",
        );
      }

      return res
        .status(
          result.created
            ? 201
            : 200,
        )
        .json({
          success: true,

          data: {
            profile: {
              id:
                result.profile_id,
              email,
              fullName:
                input.fullName,
            },

            organisation: {
              id:
                result.organisation_id,

              name:
                result.organisation_name,

              slug:
                result.organisation_slug,
            },

            membership: {
              id:
                result.membership_id,

              role:
                result.organisation_role,
            },

            created:
              Boolean(
                result.created,
              ),
          },
        });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
