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
