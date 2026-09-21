import { Router } from "express";
import { z } from "zod";

import { supabase } from "../config/supabase.js";
import { requireRole } from "../middleware/require-role.js";

const router = Router();

const createTenantSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2)
    .max(150),

  email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal("")),

  phone: z
    .string()
    .trim()
    .max(30)
    .optional(),

  emergencyContactName: z
    .string()
    .trim()
    .max(150)
    .optional(),

  emergencyContactPhone: z
    .string()
    .trim()
    .max(30)
    .optional(),
});

router.get(
  "/",
  async (req, res, next) => {
    try {
      const organisationId =
        req.membership!.organisationId;

      const { data, error } =
        await supabase
          .from("tenants")
          .select(
            `
            id,
            organisation_id,
            profile_id,
            full_name,
            email,
            phone,
            emergency_contact_name,
            emergency_contact_phone,
            status,
            created_at,
            updated_at
            `,
          )
          .eq(
            "organisation_id",
            organisationId,
          )
          .order(
            "full_name",
            { ascending: true },
          );

      if (error) {
        return next(error);
      }

      return res.json({
        success: true,
        data: data ?? [],
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/:id",
  async (req, res, next) => {
    try {
      const tenantId =
        z.string().uuid().parse(
          req.params.id,
        );

      const organisationId =
        req.membership!.organisationId;

      const [
        tenantResult,
        leasesResult,
      ] = await Promise.all([
        supabase
          .from("tenants")
          .select("*")
          .eq("id", tenantId)
          .eq(
            "organisation_id",
            organisationId,
          )
          .maybeSingle(),

        supabase
          .from("leases")
          .select(
            `
            id,
            unit_id,
            start_date,
            end_date,
            rent_amount,
            payment_frequency,
            status,
            created_at
            `,
          )
          .eq(
            "tenant_id",
            tenantId,
          )
          .eq(
            "organisation_id",
            organisationId,
          )
          .order(
            "start_date",
            { ascending: false },
          ),
      ]);

      if (tenantResult.error) {
        return next(
          tenantResult.error,
        );
      }

      if (!tenantResult.data) {
        return res.status(404).json({
          success: false,
          error: {
            code:
              "TENANT_NOT_FOUND",
            message:
              "Tenant was not found.",
          },
        });
      }

      if (leasesResult.error) {
        return next(
          leasesResult.error,
        );
      }

      return res.json({
        success: true,

        data: {
          ...tenantResult.data,
          leases:
            leasesResult.data ?? [],
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/",
  requireRole(
    "OWNER",
    "ADMIN",
    "PROPERTY_MANAGER",
  ),
  async (req, res, next) => {
    try {
      const input =
        createTenantSchema.parse(
          req.body,
        );

      const {
        data,
        error,
      } = await supabase.rpc(
        "create_tenant_record",
        {
          p_user_id:
            req.user!.id,

          p_organisation_id:
            req.membership!
              .organisationId,

          p_full_name:
            input.fullName,

          p_email:
            input.email ?? "",

          p_phone:
            input.phone ?? "",

          p_emergency_contact_name:
            input.emergencyContactName ??
            "",

          p_emergency_contact_phone:
            input.emergencyContactPhone ??
            "",
        },
      );

      if (error) {
        if (error.code === "23505") {
          return res.status(409).json({
            success: false,

            error: {
              code:
                "TENANT_EMAIL_EXISTS",

              message:
                "A tenant with this email already exists in the organisation.",
            },
          });
        }

        return next(error);
      }

      return res
        .status(201)
        .json({
          success: true,
          data,
        });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
