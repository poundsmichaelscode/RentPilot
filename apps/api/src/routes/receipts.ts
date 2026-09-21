import { Router } from "express";
import { z } from "zod";

import { supabase } from "../config/supabase.js";

const router = Router();

router.get(
  "/",
  async (req, res, next) => {
    try {
      const organisationId =
        req.membership!.organisationId;

      const { data, error } =
        await supabase
          .from("receipts")
          .select(
            `
            id,
            organisation_id,
            payment_id,
            receipt_number,
            storage_key,
            status,
            issued_by,
            issued_at,
            created_at
            `,
          )
          .eq(
            "organisation_id",
            organisationId,
          )
          .order(
            "issued_at",
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
      const receiptId =
        z.string().uuid().parse(
          req.params.id,
        );

      const organisationId =
        req.membership!.organisationId;

      const { data, error } =
        await supabase
          .from("receipts")
          .select(
            `
            id,
            organisation_id,
            payment_id,
            receipt_number,
            storage_key,
            status,
            issued_by,
            issued_at,
            created_at
            `,
          )
          .eq("id", receiptId)
          .eq(
            "organisation_id",
            organisationId,
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
                "RECEIPT_NOT_FOUND",

              message:
                "Receipt was not found.",
            },
          });
      }

      const payment =
        await supabase
          .from("rent_payments")
          .select(
            `
            id,
            lease_id,
            rent_charge_id,
            amount,
            payment_date,
            payment_method,
            reference,
            notes
            `,
          )
          .eq(
            "id",
            data.payment_id,
          )
          .eq(
            "organisation_id",
            organisationId,
          )
          .maybeSingle();

      if (payment.error) {
        return next(payment.error);
      }

      return res.json({
        success: true,

        data: {
          ...data,
          payment:
            payment.data,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
