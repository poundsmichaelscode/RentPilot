import {
  Router,
  type Response,
} from "express";

import {
  z,
} from "zod";

import {
  supabase,
} from "../config/supabase.js";

import type {
  OrganisationRole,
} from "../types/organisation.js";

const router = Router();

const expenseRoles:
  OrganisationRole[] = [
    "OWNER",
    "ADMIN",
    "PROPERTY_MANAGER",
    "ACCOUNTANT",
  ];

const deleteRoles:
  OrganisationRole[] = [
    "OWNER",
    "ADMIN",
  ];

const categorySchema =
  z.enum([
    "MAINTENANCE",
    "REPAIRS",
    "UTILITIES",
    "INSURANCE",
    "PROPERTY_TAX",
    "SECURITY",
    "CLEANING",
    "MANAGEMENT_FEE",
    "LEGAL_PROFESSIONAL",
    "RENOVATION",
    "OTHER",
  ]);

const statusSchema =
  z.enum([
    "PENDING",
    "PAID",
    "CANCELLED",
  ]);

const paymentMethodSchema =
  z.enum([
    "BANK_TRANSFER",
    "CASH",
    "CARD",
    "POS",
    "CHEQUE",
    "OTHER",
  ]);

const listQuerySchema =
  z.object({
    page: z.coerce
      .number()
      .int()
      .min(1)
      .default(1),

    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(25),

    category:
      categorySchema.optional(),

    status:
      statusSchema.optional(),

    propertyId: z
      .string()
      .uuid()
      .optional(),

    unitId: z
      .string()
      .uuid()
      .optional(),

    from: z
      .string()
      .date()
      .optional(),

    to: z
      .string()
      .date()
      .optional(),
  });

const createExpenseSchema =
  z.object({
    propertyId: z
      .string()
      .uuid()
      .nullable()
      .optional(),

    unitId: z
      .string()
      .uuid()
      .nullable()
      .optional(),

    category:
      categorySchema,

    description: z
      .string()
      .trim()
      .min(2)
      .max(500),

    amount: z.coerce
      .number()
      .positive(),

    currency: z
      .string()
      .trim()
      .length(3)
      .transform(
        (value) =>
          value.toUpperCase(),
      )
      .optional(),

    expenseDate: z
      .string()
      .date(),

    vendorName: z
      .string()
      .trim()
      .max(200)
      .nullable()
      .optional(),

    reference: z
      .string()
      .trim()
      .max(200)
      .nullable()
      .optional(),

    paymentMethod:
      paymentMethodSchema
        .nullable()
        .optional(),

    status:
      statusSchema
        .default("PAID"),

    notes: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional(),
  });

const updateExpenseSchema =
  createExpenseSchema
    .partial()
    .refine(
      (value) =>
        Object.keys(value)
          .length > 0,
      {
        message:
          "At least one expense field is required.",
      },
    );

function hasRole(
  role:
    | OrganisationRole
    | undefined,
  allowed:
    OrganisationRole[],
) {
  return Boolean(
    role &&
      allowed.includes(role),
  );
}

function forbidden(
  res: Response,
) {
  return res
    .status(403)
    .json({
      success: false,

      error: {
        code:
          "EXPENSE_ACCESS_FORBIDDEN",

        message:
          "You do not have permission to manage expenses.",
      },
    });
}

router.get(
  "/",
  async (
    req,
    res,
    next,
  ) => {
    try {
      const membership =
        req.membership!;

      if (
        !hasRole(
          membership.role,
          expenseRoles,
        )
      ) {
        return forbidden(res);
      }

      const query =
        listQuerySchema.parse(
          req.query,
        );

      const fromRow =
        (query.page - 1) *
        query.pageSize;

      const toRow =
        fromRow +
        query.pageSize -
        1;

      let request =
        supabase
          .from("expenses")
          .select(
            `
            id,
            organisation_id,
            property_id,
            unit_id,
            category,
            description,
            amount,
            currency,
            expense_date,
            vendor_name,
            reference,
            payment_method,
            status,
            notes,
            created_by,
            updated_by,
            cancelled_by,
            cancelled_at,
            created_at,
            updated_at
            `,
            {
              count: "exact",
            },
          )
          .eq(
            "organisation_id",
            membership.organisationId,
          )
          .order(
            "expense_date",
            {
              ascending: false,
            },
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          )
          .range(
            fromRow,
            toRow,
          );

      if (query.category) {
        request =
          request.eq(
            "category",
            query.category,
          );
      }

      if (query.status) {
        request =
          request.eq(
            "status",
            query.status,
          );
      }

      if (query.propertyId) {
        request =
          request.eq(
            "property_id",
            query.propertyId,
          );
      }

      if (query.unitId) {
        request =
          request.eq(
            "unit_id",
            query.unitId,
          );
      }

      if (query.from) {
        request =
          request.gte(
            "expense_date",
            query.from,
          );
      }

      if (query.to) {
        request =
          request.lte(
            "expense_date",
            query.to,
          );
      }

      const {
        data,
        count,
        error,
      } = await request;

      if (error) {
        return next(error);
      }

      const total =
        count ?? 0;

      return res.json({
        success: true,

        data:
          data ?? [],

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
      return next(error);
    }
  },
);

router.get(
  "/:id",
  async (
    req,
    res,
    next,
  ) => {
    try {
      const membership =
        req.membership!;

      if (
        !hasRole(
          membership.role,
          expenseRoles,
        )
      ) {
        return forbidden(res);
      }

      const id =
        z.string()
          .uuid()
          .parse(
            req.params.id,
          );

      const {
        data,
        error,
      } = await supabase
        .from("expenses")
        .select("*")
        .eq(
          "id",
          id,
        )
        .eq(
          "organisation_id",
          membership.organisationId,
        )
        .maybeSingle();

      if (error) {
        return next(error);
      }

      if (!data) {
        return res
          .status(404)
          .json({
            success: false,

            error: {
              code:
                "EXPENSE_NOT_FOUND",

              message:
                "Expense was not found.",
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

router.post(
  "/",
  async (
    req,
    res,
    next,
  ) => {
    try {
      const membership =
        req.membership!;

      if (
        !hasRole(
          membership.role,
          expenseRoles,
        )
      ) {
        return forbidden(res);
      }

      const body =
        createExpenseSchema.parse(
          req.body,
        );

      let currency =
        body.currency;

      if (!currency) {
        const {
          data:
            organisation,
          error:
            organisationError,
        } = await supabase
          .from(
            "organisations",
          )
          .select(
            "default_currency",
          )
          .eq(
            "id",
            membership.organisationId,
          )
          .single();

        if (
          organisationError
        ) {
          return next(
            organisationError,
          );
        }

        currency =
          organisation
            .default_currency ??
          "NGN";
      }

      const cancelled =
        body.status ===
        "CANCELLED";

      const {
        data,
        error,
      } = await supabase
        .from("expenses")
        .insert({
          organisation_id:
            membership.organisationId,

          property_id:
            body.propertyId ??
            null,

          unit_id:
            body.unitId ??
            null,

          category:
            body.category,

          description:
            body.description,

          amount:
            body.amount,

          currency,

          expense_date:
            body.expenseDate,

          vendor_name:
            body.vendorName ??
            null,

          reference:
            body.reference ??
            null,

          payment_method:
            body.paymentMethod ??
            null,

          status:
            body.status,

          notes:
            body.notes ??
            null,

          created_by:
            req.user!.id,

          updated_by:
            req.user!.id,

          cancelled_by:
            cancelled
              ? req.user!.id
              : null,
        })
        .select("*")
        .single();

      if (error) {
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
  "/:id",
  async (
    req,
    res,
    next,
  ) => {
    try {
      const membership =
        req.membership!;

      if (
        !hasRole(
          membership.role,
          expenseRoles,
        )
      ) {
        return forbidden(res);
      }

      const id =
        z.string()
          .uuid()
          .parse(
            req.params.id,
          );

      const body =
        updateExpenseSchema.parse(
          req.body,
        );

      const {
        data: existing,
        error:
          existingError,
      } = await supabase
        .from("expenses")
        .select(
          "id,status",
        )
        .eq(
          "id",
          id,
        )
        .eq(
          "organisation_id",
          membership.organisationId,
        )
        .maybeSingle();

      if (existingError) {
        return next(
          existingError,
        );
      }

      if (!existing) {
        return res
          .status(404)
          .json({
            success: false,

            error: {
              code:
                "EXPENSE_NOT_FOUND",

              message:
                "Expense was not found.",
            },
          });
      }

      if (
        existing.status ===
        "CANCELLED"
      ) {
        return res
          .status(409)
          .json({
            success: false,

            error: {
              code:
                "CANCELLED_EXPENSE_IMMUTABLE",

              message:
                "A cancelled expense cannot be modified.",
            },
          });
      }

      const update:
        Record<
          string,
          unknown
        > = {
          updated_by:
            req.user!.id,
        };

      if (
        body.propertyId !==
        undefined
      ) {
        update.property_id =
          body.propertyId;
      }

      if (
        body.unitId !==
        undefined
      ) {
        update.unit_id =
          body.unitId;
      }

      if (
        body.category !==
        undefined
      ) {
        update.category =
          body.category;
      }

      if (
        body.description !==
        undefined
      ) {
        update.description =
          body.description;
      }

      if (
        body.amount !==
        undefined
      ) {
        update.amount =
          body.amount;
      }

      if (
        body.currency !==
        undefined
      ) {
        update.currency =
          body.currency;
      }

      if (
        body.expenseDate !==
        undefined
      ) {
        update.expense_date =
          body.expenseDate;
      }

      if (
        body.vendorName !==
        undefined
      ) {
        update.vendor_name =
          body.vendorName;
      }

      if (
        body.reference !==
        undefined
      ) {
        update.reference =
          body.reference;
      }

      if (
        body.paymentMethod !==
        undefined
      ) {
        update.payment_method =
          body.paymentMethod;
      }

      if (
        body.notes !==
        undefined
      ) {
        update.notes =
          body.notes;
      }

      if (
        body.status !==
        undefined
      ) {
        update.status =
          body.status;

        update.cancelled_by =
          body.status ===
          "CANCELLED"
            ? req.user!.id
            : null;
      }

      const {
        data,
        error,
      } = await supabase
        .from("expenses")
        .update(update)
        .eq(
          "id",
          id,
        )
        .eq(
          "organisation_id",
          membership.organisationId,
        )
        .select("*")
        .single();

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
  },
);

router.delete(
  "/:id",
  async (
    req,
    res,
    next,
  ) => {
    try {
      const membership =
        req.membership!;

      if (
        !hasRole(
          membership.role,
          deleteRoles,
        )
      ) {
        return res
          .status(403)
          .json({
            success: false,

            error: {
              code:
                "EXPENSE_DELETE_FORBIDDEN",

              message:
                "Only organisation owners and administrators can delete expenses.",
            },
          });
      }

      const id =
        z.string()
          .uuid()
          .parse(
            req.params.id,
          );

      const {
        data,
        error,
      } = await supabase.rpc(
        "delete_expense",
        {
          p_user_id:
            req.user!.id,

          p_organisation_id:
            membership.organisationId,

          p_expense_id:
            id,
        },
      );

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
  },
);

export default router;
