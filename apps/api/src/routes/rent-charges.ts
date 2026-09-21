import { Router } from "express";
import { z } from "zod";

import { supabase } from "../config/supabase.js";
import { requireRole } from "../middleware/require-role.js";

const router = Router();

const generateSchema = z.object({
  leaseId: z.string().uuid(),

  dueDate: z
    .string()
    .date()
    .optional(),
});

const manualSchema = z
  .object({
    leaseId: z.string().uuid(),
    periodStart: z.string().date(),
    periodEnd: z.string().date(),
    dueDate: z.string().date(),

    expectedAmount: z.coerce
      .number()
      .positive(),

    notes: z
      .string()
      .trim()
      .max(3000)
      .optional(),
  })
  .refine(
    (value) =>
      value.periodEnd >=
      value.periodStart,
    {
      path: ["periodEnd"],
      message:
        "Period end must be on or after period start.",
    },
  );

router.get(
  "/",
  async (req, res, next) => {
    try {
      const organisationId =
        req.membership!.organisationId;

      /*
       * Keep overdue state current whenever charges
       * are requested. A scheduled worker will later
       * perform this proactively as well.
       */
      const refresh =
        await supabase.rpc(
          "refresh_rent_charge_statuses",
          {
            p_user_id:
              req.user!.id,

            p_organisation_id:
              organisationId,
          },
        );

      if (refresh.error) {
        return next(refresh.error);
      }

      const { data, error } =
        await supabase
          .from("rent_charges")
          .select(
            `
            id,
            organisation_id,
            lease_id,
            period_start,
            period_end,
            due_date,
            expected_amount,
            waived_amount,
            status,
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
            "due_date",
            { ascending: true },
          );

      if (error) {
        return next(error);
      }

      const chargeIds =
        (data ?? []).map(
          (charge) => charge.id,
        );

      let paymentRows: {
        rent_charge_id:
          | string
          | null;
        amount: number | string;
      }[] = [];

      if (chargeIds.length > 0) {
        const payments =
          await supabase
            .from("rent_payments")
            .select(
              "rent_charge_id,amount",
            )
            .eq(
              "organisation_id",
              organisationId,
            )
            .in(
              "rent_charge_id",
              chargeIds,
            );

        if (payments.error) {
          return next(payments.error);
        }

        paymentRows =
          payments.data ?? [];
      }

      const paidByCharge =
        new Map<string, number>();

      for (const payment of paymentRows) {
        if (!payment.rent_charge_id) {
          continue;
        }

        paidByCharge.set(
          payment.rent_charge_id,
          (
            paidByCharge.get(
              payment.rent_charge_id,
            ) ?? 0
          ) + Number(payment.amount),
        );
      }

      const enriched =
        (data ?? []).map(
          (charge) => {
            const paid =
              paidByCharge.get(
                charge.id,
              ) ?? 0;

            const due =
              Number(
                charge.expected_amount,
              ) -
              Number(
                charge.waived_amount,
              );

            return {
              ...charge,

              paid_amount: paid,

              balance:
                Math.max(
                  due - paid,
                  0,
                ),
            };
          },
        );

      return res.json({
        success: true,
        data: enriched,
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/generate",
  requireRole(
    "OWNER",
    "ADMIN",
    "PROPERTY_MANAGER",
    "ACCOUNTANT",
  ),
  async (req, res, next) => {
    try {
      const input =
        generateSchema.parse(
          req.body,
        );

      const { data, error } =
        await supabase.rpc(
          "generate_next_rent_charge",
          {
            p_user_id:
              req.user!.id,

            p_organisation_id:
              req.membership!
                .organisationId,

            p_lease_id:
              input.leaseId,

            p_due_date:
              input.dueDate ??
              null,
          },
        );

      if (error) {
        if (
          error.message.includes(
            "CUSTOM_FREQUENCY_REQUIRES_MANUAL_CHARGE",
          )
        ) {
          return res
            .status(409)
            .json({
              success: false,

              error: {
                code:
                  "CUSTOM_FREQUENCY_REQUIRES_MANUAL_CHARGE",

                message:
                  "Custom-frequency leases require an explicit billing period.",
              },
            });
        }

        if (
          error.message.includes(
            "LEASE_FULLY_BILLED",
          )
        ) {
          return res
            .status(409)
            .json({
              success: false,

              error: {
                code:
                  "LEASE_FULLY_BILLED",

                message:
                  "All billing periods for this lease have already been generated.",
              },
            });
        }

        return next(error);
      }

      return res
        .status(
          data?.created
            ? 201
            : 200,
        )
        .json({
          success: true,
          data,
        });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/manual",
  requireRole(
    "OWNER",
    "ADMIN",
    "PROPERTY_MANAGER",
    "ACCOUNTANT",
  ),
  async (req, res, next) => {
    try {
      const input =
        manualSchema.parse(
          req.body,
        );

      const { data, error } =
        await supabase.rpc(
          "create_manual_rent_charge",
          {
            p_user_id:
              req.user!.id,

            p_organisation_id:
              req.membership!
                .organisationId,

            p_lease_id:
              input.leaseId,

            p_period_start:
              input.periodStart,

            p_period_end:
              input.periodEnd,

            p_due_date:
              input.dueDate,

            p_expected_amount:
              input.expectedAmount,

            p_notes:
              input.notes ?? "",
          },
        );

      if (error) {
        if (error.code === "23505") {
          return res
            .status(409)
            .json({
              success: false,

              error: {
                code:
                  "RENT_CHARGE_EXISTS",

                message:
                  "A charge already exists for this lease and billing period.",
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
