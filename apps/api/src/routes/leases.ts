import { Router } from "express";
import { z } from "zod";

import { supabase } from "../config/supabase.js";
import { requireRole } from "../middleware/require-role.js";

const router = Router();

const paymentFrequencySchema =
  z.enum([
    "MONTHLY",
    "QUARTERLY",
    "BIANNUAL",
    "ANNUAL",
    "CUSTOM",
  ]);

const createLeaseSchema = z.object({
  unitId:
    z.string().uuid(),

  tenantId:
    z.string().uuid(),

  startDate:
    z.coerce.date(),

  endDate:
    z.coerce.date(),

  rentAmount:
    z.coerce.number()
      .nonnegative(),

  paymentFrequency:
    paymentFrequencySchema
      .default("ANNUAL"),

  securityDeposit:
    z.coerce.number()
      .nonnegative()
      .default(0),

  gracePeriodDays:
    z.coerce.number()
      .int()
      .min(0)
      .max(90)
      .default(0),

  lateFee:
    z.coerce.number()
      .nonnegative()
      .default(0),

  status:
    z.enum([
      "DRAFT",
      "ACTIVE",
    ])
      .default("ACTIVE"),

  leaseDocumentKey:
    z.string()
      .trim()
      .max(1000)
      .optional(),

  notes:
    z.string()
      .trim()
      .max(3000)
      .optional(),
})
.refine(
  (value) =>
    value.endDate >
    value.startDate,
  {
    message:
      "Lease end date must be after the start date.",
    path: ["endDate"],
  },
);

const statusSchema = z.object({
  status: z.enum([
    "ACTIVE",
    "EXPIRING_SOON",
    "EXPIRED",
    "RENEWED",
    "TERMINATED",
  ]),
});

function isoDate(
  date: Date,
) {
  return date
    .toISOString()
    .slice(0, 10);
}

router.get(
  "/",
  async (req, res, next) => {
    try {
      const organisationId =
        req.membership!.organisationId;

      const { data, error } =
        await supabase
          .from("leases")
          .select(
            `
            id,
            organisation_id,
            unit_id,
            tenant_id,
            start_date,
            end_date,
            rent_amount,
            payment_frequency,
            security_deposit,
            grace_period_days,
            late_fee,
            status,
            lease_document_key,
            notes,
            created_at,
            updated_at
            `,
          )
          .eq(
            "organisation_id",
            organisationId,
          )
          .order(
            "start_date",
            { ascending: false },
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
      const leaseId =
        z.string().uuid().parse(
          req.params.id,
        );

      const organisationId =
        req.membership!.organisationId;

      const {
        data: lease,
        error,
      } = await supabase
        .from("leases")
        .select("*")
        .eq("id", leaseId)
        .eq(
          "organisation_id",
          organisationId,
        )
        .maybeSingle();

      if (error) {
        return next(error);
      }

      if (!lease) {
        return res.status(404).json({
          success: false,

          error: {
            code:
              "LEASE_NOT_FOUND",
            message:
              "Lease was not found.",
          },
        });
      }

      const [
        tenantResult,
        unitResult,
      ] = await Promise.all([
        supabase
          .from("tenants")
          .select(
            "id,full_name,email,phone,status",
          )
          .eq(
            "id",
            lease.tenant_id,
          )
          .eq(
            "organisation_id",
            organisationId,
          )
          .maybeSingle(),

        supabase
          .from("units")
          .select(
            `
            id,
            property_id,
            unit_number,
            unit_type,
            status,
            monthly_rent
            `,
          )
          .eq(
            "id",
            lease.unit_id,
          )
          .eq(
            "organisation_id",
            organisationId,
          )
          .maybeSingle(),
      ]);

      if (tenantResult.error) {
        return next(
          tenantResult.error,
        );
      }

      if (unitResult.error) {
        return next(
          unitResult.error,
        );
      }

      return res.json({
        success: true,

        data: {
          ...lease,
          tenant:
            tenantResult.data,
          unit:
            unitResult.data,
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
        createLeaseSchema.parse(
          req.body,
        );

      const {
        data,
        error,
      } = await supabase.rpc(
        "create_lease_record",
        {
          p_user_id:
            req.user!.id,

          p_organisation_id:
            req.membership!
              .organisationId,

          p_unit_id:
            input.unitId,

          p_tenant_id:
            input.tenantId,

          p_start_date:
            isoDate(
              input.startDate,
            ),

          p_end_date:
            isoDate(
              input.endDate,
            ),

          p_rent_amount:
            input.rentAmount,

          p_payment_frequency:
            input.paymentFrequency,

          p_security_deposit:
            input.securityDeposit,

          p_grace_period_days:
            input.gracePeriodDays,

          p_late_fee:
            input.lateFee,

          p_status:
            input.status,

          p_lease_document_key:
            input.leaseDocumentKey ??
            "",

          p_notes:
            input.notes ?? "",
        },
      );

      if (error) {
        if (
          error.message.includes(
            "LEASE_DATE_CONFLICT",
          )
        ) {
          return res.status(409).json({
            success: false,

            error: {
              code:
                "LEASE_DATE_CONFLICT",

              message:
                "This unit already has an overlapping live lease.",
            },
          });
        }

        if (
          error.message.includes(
            "UNIT_NOT_AVAILABLE",
          )
        ) {
          return res.status(409).json({
            success: false,

            error: {
              code:
                "UNIT_NOT_AVAILABLE",

              message:
                "This unit is not currently available for an active lease.",
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

router.patch(
  "/:id/status",
  requireRole(
    "OWNER",
    "ADMIN",
    "PROPERTY_MANAGER",
  ),
  async (req, res, next) => {
    try {
      const leaseId =
        z.string().uuid().parse(
          req.params.id,
        );

      const input =
        statusSchema.parse(
          req.body,
        );

      const {
        data,
        error,
      } = await supabase.rpc(
        "change_lease_status",
        {
          p_user_id:
            req.user!.id,

          p_organisation_id:
            req.membership!
              .organisationId,

          p_lease_id:
            leaseId,

          p_status:
            input.status,
        },
      );

      if (error) {
        if (
          error.message.includes(
            "INVALID_LEASE_STATUS_TRANSITION",
          )
        ) {
          return res.status(409).json({
            success: false,

            error: {
              code:
                "INVALID_LEASE_STATUS_TRANSITION",

              message:
                "That lease status transition is not allowed.",
            },
          });
        }

        if (
          error.message.includes(
            "LEASE_NOT_YET_EXPIRED",
          )
        ) {
          return res.status(409).json({
            success: false,

            error: {
              code:
                "LEASE_NOT_YET_EXPIRED",

              message:
                "Use terminated for a lease ending before its contractual end date.",
            },
          });
        }

        return next(error);
      }

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
