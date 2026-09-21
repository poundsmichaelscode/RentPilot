import { Router } from "express";
import { z } from "zod";

import { supabase } from "../config/supabase.js";

const router = Router();

const MANAGE_ROLES = new Set([
  "OWNER",
  "ADMIN",
  "PROPERTY_MANAGER",
]);

/*
 * OCCUPIED is intentionally excluded.
 * Lease lifecycle triggers own occupancy state.
 */
const writableUnitStatusSchema = z.enum([
  "VACANT",
  "RESERVED",
  "MAINTENANCE",
  "INACTIVE",
]);

const createUnitSchema = z.object({
  propertyId: z.string().uuid(),

  unitNumber: z
    .string()
    .trim()
    .min(1)
    .max(50),

  unitType: z
    .string()
    .trim()
    .min(1)
    .max(80),

  bedrooms: z.coerce
    .number()
    .int()
    .min(0)
    .max(50)
    .default(0),

  bathrooms: z.coerce
    .number()
    .min(0)
    .max(50)
    .default(0),

  floor: z
    .string()
    .trim()
    .max(50)
    .nullable()
    .optional(),

  monthlyRent: z.coerce
    .number()
    .min(0),

  securityDeposit: z.coerce
    .number()
    .min(0)
    .default(0),

  status: writableUnitStatusSchema
    .default("VACANT"),
});

const updateUnitSchema =
  createUnitSchema
    .omit({
      propertyId: true,
    })
    .partial();

function canManage(
  role: string | undefined,
) {
  return Boolean(
    role &&
      MANAGE_ROLES.has(role),
  );
}

/*
 * GET /api/v1/units
 * GET /api/v1/units?propertyId=<uuid>
 */
router.get(
  "/",
  async (req, res, next) => {
    try {
      const organisationId =
        req.membership!.organisationId;

      const propertyId =
        typeof req.query.propertyId ===
        "string"
          ? req.query.propertyId
          : undefined;

      let query = supabase
        .from("units")
        .select(
          `
          id,
          organisation_id,
          property_id,
          unit_number,
          unit_type,
          bedrooms,
          bathrooms,
          floor,
          monthly_rent,
          security_deposit,
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
          "unit_number",
          {
            ascending: true,
          },
        );

      if (propertyId) {
        const parsed =
          z.string().uuid().parse(
            propertyId,
          );

        query = query.eq(
          "property_id",
          parsed,
        );
      }

      const {
        data,
        error,
      } = await query;

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

/*
 * GET /api/v1/units/:id
 */
router.get(
  "/:id",
  async (req, res, next) => {
    try {
      const unitId =
        z.string().uuid().parse(
          req.params.id,
        );

      const organisationId =
        req.membership!.organisationId;

      const {
        data,
        error,
      } = await supabase
        .from("units")
        .select(
          `
          id,
          organisation_id,
          property_id,
          unit_number,
          unit_type,
          bedrooms,
          bathrooms,
          floor,
          monthly_rent,
          security_deposit,
          status,
          created_at,
          updated_at
          `,
        )
        .eq("id", unitId)
        .eq(
          "organisation_id",
          organisationId,
        )
        .maybeSingle();

      if (error) {
        return next(error);
      }

      if (!data) {
        return res.status(404).json({
          success: false,

          error: {
            code: "UNIT_NOT_FOUND",
            message:
              "Unit was not found.",
          },
        });
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

/*
 * POST /api/v1/units
 */
router.post(
  "/",
  async (req, res, next) => {
    try {
      if (
        !canManage(
          req.membership!.role,
        )
      ) {
        return res.status(403).json({
          success: false,

          error: {
            code:
              "INSUFFICIENT_PERMISSION",

            message:
              "You do not have permission to create units.",
          },
        });
      }

      const input =
        createUnitSchema.parse(
          req.body,
        );

      const organisationId =
        req.membership!.organisationId;

      /*
       * Never trust a property ID from
       * the browser without checking that
       * it belongs to the active organisation.
       */
      const {
        data: property,
        error: propertyError,
      } = await supabase
        .from("properties")
        .select("id")
        .eq(
          "id",
          input.propertyId,
        )
        .eq(
          "organisation_id",
          organisationId,
        )
        .maybeSingle();

      if (propertyError) {
        return next(propertyError);
      }

      if (!property) {
        return res.status(404).json({
          success: false,

          error: {
            code:
              "PROPERTY_NOT_FOUND",

            message:
              "Property was not found in this organisation.",
          },
        });
      }

      const {
        data,
        error,
      } = await supabase
        .from("units")
        .insert({
          organisation_id:
            organisationId,

          property_id:
            input.propertyId,

          unit_number:
            input.unitNumber,

          unit_type:
            input.unitType,

          bedrooms:
            input.bedrooms,

          bathrooms:
            input.bathrooms,

          floor:
            input.floor ?? null,

          monthly_rent:
            input.monthlyRent,

          security_deposit:
            input.securityDeposit,

          status:
            input.status,
        })
        .select()
        .single();

      if (error) {
        /*
         * Unique property/unit constraint.
         */
        if (error.code === "23505") {
          return res.status(409).json({
            success: false,

            error: {
              code:
                "UNIT_ALREADY_EXISTS",

              message:
                "A unit with this number already exists for the property.",
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

/*
 * PATCH /api/v1/units/:id
 */
router.patch(
  "/:id",
  async (req, res, next) => {
    try {
      if (
        !canManage(
          req.membership!.role,
        )
      ) {
        return res.status(403).json({
          success: false,

          error: {
            code:
              "INSUFFICIENT_PERMISSION",

            message:
              "You do not have permission to update units.",
          },
        });
      }

      const unitId =
        z.string().uuid().parse(
          req.params.id,
        );

      const input =
        updateUnitSchema.parse(
          req.body,
        );

      const organisationId =
        req.membership!.organisationId;

      const update: Record<
        string,
        unknown
      > = {};

      if (
        input.unitNumber !==
        undefined
      ) {
        update.unit_number =
          input.unitNumber;
      }

      if (
        input.unitType !==
        undefined
      ) {
        update.unit_type =
          input.unitType;
      }

      if (
        input.bedrooms !==
        undefined
      ) {
        update.bedrooms =
          input.bedrooms;
      }

      if (
        input.bathrooms !==
        undefined
      ) {
        update.bathrooms =
          input.bathrooms;
      }

      if (input.floor !== undefined) {
        update.floor =
          input.floor;
      }

      if (
        input.monthlyRent !==
        undefined
      ) {
        update.monthly_rent =
          input.monthlyRent;
      }

      if (
        input.securityDeposit !==
        undefined
      ) {
        update.security_deposit =
          input.securityDeposit;
      }

      if (
        input.status !==
        undefined
      ) {
        update.status =
          input.status;
      }

      if (
        Object.keys(update).length ===
        0
      ) {
        return res.status(400).json({
          success: false,

          error: {
            code:
              "NO_CHANGES",

            message:
              "No unit changes were supplied.",
          },
        });
      }

      const {
        data,
        error,
      } = await supabase
        .from("units")
        .update(update)
        .eq("id", unitId)
        .eq(
          "organisation_id",
          organisationId,
        )
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === "23505") {
          return res.status(409).json({
            success: false,

            error: {
              code:
                "UNIT_ALREADY_EXISTS",

              message:
                "A unit with this number already exists for the property.",
            },
          });
        }

        return next(error);
      }

      if (!data) {
        return res.status(404).json({
          success: false,

          error: {
            code:
              "UNIT_NOT_FOUND",

            message:
              "Unit was not found.",
          },
        });
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
