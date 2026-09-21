import {
  Router,
} from "express";

import {
  z,
} from "zod";

import {
  supabase,
} from "../config/supabase.js";

const router = Router();

const propertyTypeSchema =
  z.enum([
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

const marketplaceQuerySchema =
  z.object({
    q: z
      .string()
      .trim()
      .max(120)
      .optional(),

    city: z
      .string()
      .trim()
      .max(100)
      .optional(),

    state: z
      .string()
      .trim()
      .max(100)
      .optional(),

    propertyType:
      propertyTypeSchema
        .optional(),

    minRent: z.coerce
      .number()
      .nonnegative()
      .optional(),

    maxRent: z.coerce
      .number()
      .nonnegative()
      .optional(),

    bedrooms: z.coerce
      .number()
      .int()
      .min(0)
      .max(50)
      .optional(),

    page: z.coerce
      .number()
      .int()
      .min(1)
      .default(1),

    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .default(12),
  })
  .refine(
    (value) =>
      value.minRent ===
        undefined ||
      value.maxRent ===
        undefined ||
      value.minRent <=
        value.maxRent,
    {
      path: [
        "maxRent",
      ],

      message:
        "Maximum rent must be greater than or equal to minimum rent.",
    },
  );

type MarketplaceUnit = {
  id: string;
  unit_number: string;
  unit_type: string | null;
  bedrooms: number | null;
  bathrooms:
    | number
    | string
    | null;
  floor: string | null;
  monthly_rent:
    | number
    | string;
  security_deposit:
    | number
    | string;
  status: string;
};

type MarketplaceProperty = {
  id: string;
  name: string;
  property_type:
    | string
    | null;
  address: string;
  city:
    | string
    | null;
  state:
    | string
    | null;
  country: string;
  description:
    | string
    | null;
  amenities: string[];
  images: string[];
  status: string;
  created_at: string;
  units:
    MarketplaceUnit[];
};

function marketplaceSummary(
  property:
    MarketplaceProperty,
) {
  const availableUnits =
    property.units.filter(
      (unit) =>
        unit.status ===
        "VACANT",
    );

  const rents =
    availableUnits
      .map(
        (unit) =>
          Number(
            unit.monthly_rent ??
              0,
          ),
      )
      .filter(
        (rent) =>
          Number.isFinite(
            rent,
          ),
      );

  return {
    id:
      property.id,

    name:
      property.name,

    propertyType:
      property.property_type,

    address:
      property.address,

    city:
      property.city,

    state:
      property.state,

    country:
      property.country,

    description:
      property.description,

    amenities:
      property.amenities ??
      [],

    images:
      property.images ??
      [],

    availableUnits:
      availableUnits.length,

    rentFrom:
      rents.length > 0
        ? Math.min(
            ...rents,
          )
        : null,

    rentTo:
      rents.length > 0
        ? Math.max(
            ...rents,
          )
        : null,

    bedrooms:
      [
        ...new Set(
          availableUnits
            .map(
              (unit) =>
                unit.bedrooms,
            )
            .filter(
              (
                value,
              ): value is number =>
                value !==
                null,
            ),
        ),
      ].sort(
        (a, b) =>
          a - b,
      ),

    createdAt:
      property.created_at,
  };
}

/*
 * Public marketplace.
 *
 * Only explicitly published, active properties with
 * at least one vacant unit are returned.
 *
 * Landlord/member contact details and organisation-private
 * information are intentionally excluded.
 */
router.get(
  "/",
  async (
    req,
    res,
    next,
  ) => {
    try {
      const query =
        marketplaceQuerySchema.parse(
          req.query,
        );

      const {
        data,
        error,
      } = await supabase
        .from(
          "properties",
        )
        .select(
          `
          id,
          name,
          property_type,
          address,
          city,
          state,
          country,
          description,
          amenities,
          images,
          status,
          created_at,
          units (
            id,
            unit_number,
            unit_type,
            bedrooms,
            bathrooms,
            floor,
            monthly_rent,
            security_deposit,
            status
          )
          `,
        )
        .eq(
          "is_published",
          true,
        )
        .eq(
          "status",
          "active",
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        );

      if (error) {
        return next(
          error,
        );
      }

      let listings =
        (
          data ??
          []
        )
          .map(
            (property) =>
              marketplaceSummary(
                property as MarketplaceProperty,
              ),
          )
          .filter(
            (property) =>
              property.availableUnits >
              0,
          );

      if (query.q) {
        const q =
          query.q
            .toLowerCase();

        listings =
          listings.filter(
            (property) =>
              [
                property.name,
                property.address,
                property.city,
                property.state,
                property.country,
              ]
                .filter(
                  Boolean,
                )
                .some(
                  (value) =>
                    String(
                      value,
                    )
                      .toLowerCase()
                      .includes(
                        q,
                      ),
                ),
          );
      }

      if (query.city) {
        const city =
          query.city
            .toLowerCase();

        listings =
          listings.filter(
            (property) =>
              property.city
                ?.toLowerCase() ===
              city,
          );
      }

      if (query.state) {
        const state =
          query.state
            .toLowerCase();

        listings =
          listings.filter(
            (property) =>
              property.state
                ?.toLowerCase() ===
              state,
          );
      }

      if (
        query.propertyType
      ) {
        listings =
          listings.filter(
            (property) =>
              property.propertyType ===
              query.propertyType,
          );
      }

      if (
        query.minRent !==
        undefined
      ) {
        listings =
          listings.filter(
            (property) =>
              property.rentTo !==
                null &&
              property.rentTo >=
                query.minRent!,
          );
      }

      if (
        query.maxRent !==
        undefined
      ) {
        listings =
          listings.filter(
            (property) =>
              property.rentFrom !==
                null &&
              property.rentFrom <=
                query.maxRent!,
          );
      }

      if (
        query.bedrooms !==
        undefined
      ) {
        listings =
          listings.filter(
            (property) =>
              property.bedrooms.includes(
                query.bedrooms!,
              ),
          );
      }

      const total =
        listings.length;

      const from =
        (
          query.page -
          1
        ) *
        query.pageSize;

      const paginated =
        listings.slice(
          from,
          from +
            query.pageSize,
        );

      return res.json({
        success: true,

        data:
          paginated,

        pagination: {
          page:
            query.page,

          pageSize:
            query.pageSize,

          total,

          totalPages:
            Math.ceil(
              total /
                query.pageSize,
            ),
        },
      });
    } catch (error) {
      return next(
        error,
      );
    }
  },
);

/*
 * Public marketplace detail.
 */
router.get(
  "/:id",
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

      const {
        data,
        error,
      } = await supabase
        .from(
          "properties",
        )
        .select(
          `
          id,
          name,
          property_type,
          address,
          city,
          state,
          country,
          description,
          amenities,
          images,
          status,
          created_at,
          units (
            id,
            unit_number,
            unit_type,
            bedrooms,
            bathrooms,
            floor,
            monthly_rent,
            security_deposit,
            status
          )
          `,
        )
        .eq(
          "id",
          propertyId,
        )
        .eq(
          "is_published",
          true,
        )
        .eq(
          "status",
          "active",
        )
        .maybeSingle();

      if (error) {
        return next(
          error,
        );
      }

      if (!data) {
        return res
          .status(404)
          .json({
            success:
              false,

            error: {
              code:
                "MARKETPLACE_LISTING_NOT_FOUND",

              message:
                "Marketplace listing was not found.",
            },
          });
      }

      const property =
        data as MarketplaceProperty;

      const availableUnits =
        property.units.filter(
          (unit) =>
            unit.status ===
            "VACANT",
        );

      if (
        availableUnits.length ===
        0
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            error: {
              code:
                "MARKETPLACE_LISTING_NOT_AVAILABLE",

              message:
                "This property is not currently available for rent.",
            },
          });
      }

      return res.json({
        success: true,

        data: {
          ...marketplaceSummary(
            property,
          ),

          units:
            availableUnits.map(
              (unit) => ({
                id:
                  unit.id,

                unitNumber:
                  unit.unit_number,

                unitType:
                  unit.unit_type,

                bedrooms:
                  unit.bedrooms,

                bathrooms:
                  unit.bathrooms,

                floor:
                  unit.floor,

                monthlyRent:
                  Number(
                    unit.monthly_rent,
                  ),

                securityDeposit:
                  Number(
                    unit.security_deposit,
                  ),
              }),
            ),
        },
      });
    } catch (error) {
      return next(
        error,
      );
    }
  },
);

export default router;
