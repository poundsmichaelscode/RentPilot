import {
  Router,
} from "express";

import {
  z,
} from "zod";

import {
  supabase,
} from "../config/supabase.js";

import {
  financialReportToCsv,
  type FinancialReportExport,
} from "../domain/financial-report-csv.js";

import {
  requireRole,
} from "../middleware/require-role.js";

const router = Router();

const financialReportQuerySchema =
  z
    .object({
      from: z
        .string()
        .date()
        .optional(),

      to: z
        .string()
        .date()
        .optional(),

      propertyId: z
        .string()
        .uuid()
        .optional(),
    })
    .refine(
      (value) => {
        if (
          value.from &&
          value.to
        ) {
          return (
            value.from <=
            value.to
          );
        }

        return true;
      },
      {
        message:
          "The report start date cannot be after the end date.",
        path: ["from"],
      },
    );

function todayUtc() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function firstDayOfYearUtc() {
  const now =
    new Date();

  return `${now.getUTCFullYear()}-01-01`;
}

router.get(
  "/financial",

  requireRole(
    "OWNER",
    "ADMIN",
    "PROPERTY_MANAGER",
    "ACCOUNTANT",
  ),

  async (
    req,
    res,
    next,
  ) => {
    try {
      const query =
        financialReportQuerySchema.parse(
          req.query,
        );

      const from =
        query.from ??
        firstDayOfYearUtc();

      const to =
        query.to ??
        todayUtc();

      const {
        data,
        error,
      } = await supabase.rpc(
        "get_financial_report",
        {
          p_user_id:
            req.user!.id,

          p_organisation_id:
            req.membership!
              .organisationId,

          p_from:
            from,

          p_to:
            to,

          p_property_id:
            query.propertyId ??
            null,
        },
      );

      if (error) {
        if (
          error.message.includes(
            "FINANCIAL_REPORT_ACCESS_FORBIDDEN",
          )
        ) {
          return res
            .status(403)
            .json({
              success: false,

              error: {
                code:
                  "FINANCIAL_REPORT_ACCESS_FORBIDDEN",

                message:
                  "You do not have permission to view financial reports.",
              },
            });
        }

        if (
          error.message.includes(
            "REPORT_PROPERTY_NOT_FOUND",
          )
        ) {
          return res
            .status(404)
            .json({
              success: false,

              error: {
                code:
                  "REPORT_PROPERTY_NOT_FOUND",

                message:
                  "The selected property was not found.",
              },
            });
        }

        if (
          error.message.includes(
            "REPORT_INVALID_DATE_RANGE",
          )
        ) {
          return res
            .status(400)
            .json({
              success: false,

              error: {
                code:
                  "REPORT_INVALID_DATE_RANGE",

                message:
                  "The report start date cannot be after the end date.",
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

router.get(
  "/financial.csv",

  requireRole(
    "OWNER",
    "ADMIN",
    "PROPERTY_MANAGER",
    "ACCOUNTANT",
  ),

  async (
    req,
    res,
    next,
  ) => {
    try {
      const query =
        financialReportQuerySchema.parse(
          req.query,
        );

      const from =
        query.from ??
        firstDayOfYearUtc();

      const to =
        query.to ??
        todayUtc();

      const {
        data,
        error,
      } = await supabase.rpc(
        "get_financial_report",
        {
          p_user_id:
            req.user!.id,

          p_organisation_id:
            req.membership!
              .organisationId,

          p_from:
            from,

          p_to:
            to,

          p_property_id:
            query.propertyId ??
            null,
        },
      );

      if (error) {
        if (
          error.message.includes(
            "FINANCIAL_REPORT_ACCESS_FORBIDDEN",
          )
        ) {
          return res
            .status(403)
            .json({
              success: false,

              error: {
                code:
                  "FINANCIAL_REPORT_ACCESS_FORBIDDEN",

                message:
                  "You do not have permission to export financial reports.",
              },
            });
        }

        if (
          error.message.includes(
            "REPORT_PROPERTY_NOT_FOUND",
          )
        ) {
          return res
            .status(404)
            .json({
              success: false,

              error: {
                code:
                  "REPORT_PROPERTY_NOT_FOUND",

                message:
                  "The selected property was not found.",
              },
            });
        }

        if (
          error.message.includes(
            "REPORT_INVALID_DATE_RANGE",
          )
        ) {
          return res
            .status(400)
            .json({
              success: false,

              error: {
                code:
                  "REPORT_INVALID_DATE_RANGE",

                message:
                  "The report start date cannot be after the end date.",
              },
            });
        }

        return next(error);
      }

      const csv =
        financialReportToCsv(
          data as FinancialReportExport,
        );

      const filename =
        `rentpilot-financial-report-${from}-to-${to}.csv`;

      res.setHeader(
        "Content-Type",
        "text/csv; charset=utf-8",
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );

      res.setHeader(
        "Cache-Control",
        "private, no-store",
      );

      /*
       * UTF-8 BOM helps Excel correctly recognise
       * exported text and currency labels.
       */
      return res
        .status(200)
        .send(
          `\uFEFF${csv}`,
        );
    } catch (error) {
      return next(error);
    }
  },
);


export default router;
