import { Router } from "express";
import { z } from "zod";

import { supabase } from "../config/supabase.js";
import { requireRole } from "../middleware/require-role.js";

const router = Router();

const paymentMethodSchema =
  z.enum([
    "BANK_TRANSFER",
    "CASH",
    "CARD",
    "POS",
    "CHEQUE",
    "OTHER",
  ]);

const createPaymentSchema =
  z.object({
    leaseId:
      z.string().uuid(),

    rentChargeId:
      z.string().uuid(),

    amount:
      z.coerce.number()
        .positive(),

    paymentDate:
      z.string().date(),

    paymentMethod:
      paymentMethodSchema,

    reference:
      z.string()
        .trim()
        .max(200)
        .optional(),

    notes:
      z.string()
        .trim()
        .max(3000)
        .optional(),

    idempotencyKey:
      z.string()
        .trim()
        .min(8)
        .max(200),
  });

router.get(
  "/",
  async (req, res, next) => {
    try {
      const organisationId =
        req.membership!.organisationId;

      const { data, error } =
        await supabase
          .from("rent_payments")
          .select(
            `
            id,
            organisation_id,
            lease_id,
            rent_charge_id,
            amount,
            payment_date,
            payment_method,
            reference,
            notes,
            recorded_by,
            idempotency_key,
            created_at,
            updated_at
            `,
          )
          .eq(
            "organisation_id",
            organisationId,
          )
          .order(
            "payment_date",
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

router.post(
  "/",
  requireRole(
    "OWNER",
    "ADMIN",
    "PROPERTY_MANAGER",
    "ACCOUNTANT",
  ),
  async (req, res, next) => {
    try {
      const input =
        createPaymentSchema.parse(
          req.body,
        );

      const { data, error } =
        await supabase.rpc(
          "record_rent_payment",
          {
            p_user_id:
              req.user!.id,

            p_organisation_id:
              req.membership!
                .organisationId,

            p_lease_id:
              input.leaseId,

            p_rent_charge_id:
              input.rentChargeId,

            p_amount:
              input.amount,

            p_payment_date:
              input.paymentDate,

            p_payment_method:
              input.paymentMethod,

            p_reference:
              input.reference ?? "",

            p_notes:
              input.notes ?? "",

            p_idempotency_key:
              input.idempotencyKey,
          },
        );

      if (error) {
        const knownConflict =
          [
            "PAYMENT_EXCEEDS_OUTSTANDING",
            "RENT_CHARGE_ALREADY_SETTLED",
            "RENT_CHARGE_WAIVED",
            "PAYMENT_LEASE_MISMATCH",
          ].find((code) =>
            error.message.includes(
              code,
            ),
          );

        if (knownConflict) {
          const messages:
            Record<string, string> = {
              PAYMENT_EXCEEDS_OUTSTANDING:
                "Payment exceeds the outstanding balance for this charge.",

              RENT_CHARGE_ALREADY_SETTLED:
                "This rent charge has already been settled.",

              RENT_CHARGE_WAIVED:
                "Payments cannot be recorded against a waived charge.",

              PAYMENT_LEASE_MISMATCH:
                "The selected charge does not belong to this lease.",
            };

          return res
            .status(409)
            .json({
              success: false,

              error: {
                code: knownConflict,

                message:
                  messages[
                    knownConflict
                  ],
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

export default router;
