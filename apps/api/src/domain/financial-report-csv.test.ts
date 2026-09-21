import assert from "node:assert/strict";

import {
  test,
} from "node:test";

import {
  financialReportToCsv,
  type FinancialReportExport,
} from "./financial-report-csv.js";

test(
  "financial report CSV contains summary and property rows",
  () => {
    const report:
      FinancialReportExport = {
        organisationId:
          "organisation-id",

        propertyId: null,

        from:
          "2026-01-01",

        to:
          "2026-12-31",

        currency:
          "NGN",

        summary: {
          rentCollected:
            500000,

          paidExpenses:
            125000,

          pendingExpenses:
            25000,

          netCashFlow:
            375000,

          organisationWidePaidExpenses:
            10000,

          organisationWidePendingExpenses:
            5000,
        },

        properties: [
          {
            propertyId:
              "property-id",

            propertyName:
              'Yaba "Court", Block A',

            rentCollected:
              500000,

            paidExpenses:
              115000,

            pendingExpenses:
              20000,

            netCashFlow:
              385000,
          },
        ],

        foreignCurrencyExpenses:
          [
            {
              currency:
                "USD",

              paidExpenses:
                100,

              pendingExpenses:
                50,
            },
          ],

        basis: {
          accountingBasis:
            "CASH",
        },
      };

    const csv =
      financialReportToCsv(
        report,
      );

    assert.match(
      csv,
      /Rent Collected,500000,NGN/,
    );

    assert.match(
      csv,
      /Net Cash Flow,375000,NGN/,
    );

    assert.match(
      csv,
      /"Yaba ""Court"", Block A"/,
    );

    assert.match(
      csv,
      /USD,100,50/,
    );
  },
);
