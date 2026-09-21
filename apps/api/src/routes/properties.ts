import { Router } from "express";
import { z } from "zod";

import { supabase } from "../config/supabase.js";
import { requireRole } from "../middleware/require-role.js";

const router = Router();

const propertyTypeSchema = z.enum([
  "apartment_building",
  "house",
  "duplex",
  "block_of_flats",
  "commercial_property",
  "office",
  "shop",
  "warehouse",
  "mixed_use",
  "other",
]);

const marketplacePublishingSchema =
  z.object({
    isPublished:
      z.boolean(),
  });

const createPropertySchema = z.object({
  name: z.string().trim().min(2).max(120),

  address: z.string().trim().min(5).max(300),

  city: z.string().trim().min(2).max(100).optional(),

  state: z.string().trim().min(2).max(100).optional(),

  country: z.string().trim().min(2).max(100).default("Nigeria"),

  property_type: propertyTypeSchema.optional(),

  description: z.string().trim().max(3000).optional(),

  amenities: z
    .array(z.string().trim().min(1).max(100))
    .max(50)
    .default([]),

  images: z
    .array(z.string().url())
    .max(12)
    .default([]),

  /*
   * Transitional field.
   *
   * Unit-level rent will become authoritative once the
   * Units module is implemented.
   */
  monthly_rent: z.number().nonnegative().default(0),

  is_published: z.boolean().default(false),
});

router.get("/", async (req, res, next) => {
  try {
    const organisationId =
      req.membership!.organisationId;

    const { data, error } = await supabase
      .from("properties")
      .select(
        `
        id,
        organisation_id,
        name,
        property_type,
        address,
        city,
        state,
        country,
        description,
        amenities,
        monthly_rent,
        images,
        is_published,
        status,
        created_at,
        updated_at
        `,
      )
      .eq("organisation_id", organisationId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      return next(error);
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
});


const initialUnitSchema = z.object({
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
    .max(50),

  bathrooms: z.coerce
    .number()
    .min(0)
    .max(50),

  floor: z
    .string()
    .trim()
    .max(50)
    .nullable()
    .optional(),

  monthlyRent: z.coerce
    .number()
    .nonnegative(),

  securityDeposit: z.coerce
    .number()
    .nonnegative()
    .default(0),
});

const propertySetupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(120),

  address: z
    .string()
    .trim()
    .min(5)
    .max(300),

  city: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .optional(),

  state: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .optional(),

  country: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .default("Nigeria"),

  propertyType:
    propertyTypeSchema,

  description: z
    .string()
    .trim()
    .max(3000)
    .optional(),

  amenities: z
    .array(
      z.string()
        .trim()
        .min(1)
        .max(100),
    )
    .max(50)
    .default([]),

  units: z
    .array(initialUnitSchema)
    .min(1)
    .max(200),
});


router.post(
  "/setup",
  requireRole(
    "OWNER",
    "ADMIN",
    "PROPERTY_MANAGER",
  ),
  async (req, res, next) => {
    try {
      const input =
        propertySetupSchema.parse(
          req.body,
        );

      const organisationId =
        req.membership!
          .organisationId;

      const rpcUnits =
        input.units.map(
          (unit) => ({
            unit_number:
              unit.unitNumber,

            unit_type:
              unit.unitType,

            bedrooms:
              unit.bedrooms,

            bathrooms:
              unit.bathrooms,

            floor:
              unit.floor ?? null,

            monthly_rent:
              unit.monthlyRent,

            security_deposit:
              unit.securityDeposit,
          }),
        );

      const {
        data,
        error,
      } = await supabase.rpc(
        "create_property_with_units",
        {
          p_user_id:
            req.user!.id,

          p_organisation_id:
            organisationId,

          p_name:
            input.name,

          p_address:
            input.address,

          p_city:
            input.city ?? "",

          p_state:
            input.state ?? "",

          p_country:
            input.country,

          p_property_type:
            input.propertyType,

          p_description:
            input.description ?? "",

          p_amenities:
            input.amenities,

          p_units:
            rpcUnits,
        },
      );

      if (error) {
        if (
          error.code === "23505"
        ) {
          return res
            .status(409)
            .json({
              success: false,

              error: {
                code:
                  "DUPLICATE_UNIT",

                message:
                  "Two units cannot have the same unit number within a property.",
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



router.get(
  "/:id",
  async (req, res, next) => {
    try {
      const propertyId =
        z.string().uuid().parse(
          req.params.id,
        );

      const organisationId =
        req.membership!
          .organisationId;

      const [
        propertyResult,
        unitsResult,
      ] = await Promise.all([
        supabase
          .from("properties")
          .select(
            `
            id,
            organisation_id,
            name,
            property_type,
            address,
            city,
            state,
            country,
            description,
            amenities,
            monthly_rent,
            images,
            is_published,
            status,
            created_at,
            updated_at
            `,
          )
          .eq("id", propertyId)
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
            "property_id",
            propertyId,
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
          ),
      ]);

      if (propertyResult.error) {
        return next(
          propertyResult.error,
        );
      }

      if (!propertyResult.data) {
        return res.status(404).json({
          success: false,

          error: {
            code:
              "PROPERTY_NOT_FOUND",

            message:
              "Property was not found.",
          },
        });
      }

      if (unitsResult.error) {
        return next(
          unitsResult.error,
        );
      }

      const units =
        unitsResult.data ?? [];

      const occupiedUnits =
        units.filter(
          (unit) =>
            unit.status ===
            "OCCUPIED",
        ).length;

      const vacantUnits =
        units.filter(
          (unit) =>
            unit.status ===
            "VACANT",
        ).length;

      return res.json({
        success: true,

        data: {
          ...propertyResult.data,

          units,

          summary: {
            totalUnits:
              units.length,

            occupiedUnits,

            vacantUnits,

            monthlyRent:
              units.reduce(
                (
                  total,
                  unit,
                ) =>
                  total +
                  Number(
                    unit.monthly_rent ??
                      0,
                  ),
                0,
              ),
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);



router.patch(
  "/:id/marketplace",

  requireRole(
    "OWNER",
    "ADMIN",
    "PROPERTY_MANAGER",
  ),

  async (
    req,
    res,
    next,
  ) => {
    try {
      const propertyId =
        z.string()
          .uuid()
          .parse(
            req.params.id,
          );

      const input =
        marketplacePublishingSchema.parse(
          req.body,
        );

      const {
        data,
        error,
      } = await supabase.rpc(
        "set_property_marketplace_publishing",
        {
          p_user_id:
            req.user!.id,

          p_organisation_id:
            req.membership!
              .organisationId,

          p_property_id:
            propertyId,

          p_is_published:
            input.isPublished,
        },
      );

      if (error) {
        if (
          error.message.includes(
            "MARKETPLACE_PUBLISH_FORBIDDEN",
          )
        ) {
          return res
            .status(403)
            .json({
              success: false,

              error: {
                code:
                  "MARKETPLACE_PUBLISH_FORBIDDEN",

                message:
                  "You do not have permission to publish marketplace listings.",
              },
            });
        }

        if (
          error.message.includes(
            "PROPERTY_NOT_FOUND",
          )
        ) {
          return res
            .status(404)
            .json({
              success: false,

              error: {
                code:
                  "PROPERTY_NOT_FOUND",

                message:
                  "Property was not found.",
              },
            });
        }

        if (
          error.message.includes(
            "MARKETPLACE_REQUIRES_VACANT_UNIT",
          )
        ) {
          return res
            .status(409)
            .json({
              success: false,

              error: {
                code:
                  "MARKETPLACE_REQUIRES_VACANT_UNIT",

                message:
                  "A property must have at least one vacant unit before it can be published.",
              },
            });
        }

        if (
          error.message.includes(
            "MARKETPLACE_PROPERTY_NOT_ACTIVE",
          )
        ) {
          return res
            .status(409)
            .json({
              success: false,

              error: {
                code:
                  "MARKETPLACE_PROPERTY_NOT_ACTIVE",

                message:
                  "Only active properties can be published.",
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
        createPropertySchema.parse(req.body);

      const organisationId =
        req.membership!.organisationId;

      /*
       * landlord_id remains temporarily because it is a
       * NOT NULL column in the legacy schema.
       *
       * organisation_id is now the authoritative SaaS
       * ownership boundary.
       */
      const { data, error } = await supabase
        .from("properties")
        .insert({
          ...input,

          organisation_id: organisationId,

          landlord_id: req.user!.id,

          /*
           * Legacy property-level unit count.
           * Actual units will live in public.units.
           */
          units: 1,
        })
        .select(
          `
          id,
          organisation_id,
          name,
          property_type,
          address,
          city,
          state,
          country,
          description,
          amenities,
          monthly_rent,
          images,
          is_published,
          status,
          created_at,
          updated_at
          `,
        )
        .single();

      if (error) {
        return next(error);
      }

      return res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
