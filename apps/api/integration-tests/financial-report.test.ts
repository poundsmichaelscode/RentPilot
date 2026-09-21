import assert from "node:assert/strict";

import {
  test,
} from "node:test";

import "../src/config/env.js";

import {
  createClient,
} from "@supabase/supabase-js";

const RUN_REMOTE =
  process.env.RUN_REMOTE_INTEGRATION_TESTS ===
  "true";

function requireEnv(
  name: string,
  value: string | undefined,
) {
  if (!value) {
    throw new Error(
      `${name} is required.`,
    );
  }

  return value;
}

const supabase =
  createClient(
    requireEnv(
      "SUPABASE_URL",
      process.env.SUPABASE_URL,
    ),

    requireEnv(
      "SUPABASE_SECRET_KEY",
      process.env.SUPABASE_SECRET_KEY,
    ),

    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

test(
  "financial report is organisation scoped and internally consistent",
  {
    skip:
      !RUN_REMOTE,
  },

  async () => {
    const organisationId =
      requireEnv(
        "RENT_TEST_ORGANISATION_ID",
        process.env
          .RENT_TEST_ORGANISATION_ID,
      );

    const actorId =
      requireEnv(
        "RENT_TEST_ACTOR_USER_ID",
        process.env
          .RENT_TEST_ACTOR_USER_ID,
      );

    const {
      data,
      error,
    } = await supabase.rpc(
      "get_financial_report",
      {
        p_user_id:
          actorId,

        p_organisation_id:
          organisationId,

        p_from:
          "2026-01-01",

        p_to:
          "2026-12-31",

        p_property_id:
          null,
      },
    );

    if (error) {
      throw error;
    }

    assert.equal(
      data.organisationId,
      organisationId,
    );

    assert.equal(
      data.currency,
      "NGN",
    );

    assert.equal(
      data.basis
        .accountingBasis,
      "CASH",
    );

    assert.equal(
      data.basis
        .rentIncomeUses,
      "RECORDED_PAYMENTS",
    );

    assert.equal(
      data.basis
        .expensesUse,
      "PAID_EXPENSES",
    );

    const rentCollected =
      Number(
        data.summary
          .rentCollected,
      );

    const paidExpenses =
      Number(
        data.summary
          .paidExpenses,
      );

    const netCashFlow =
      Number(
        data.summary
          .netCashFlow,
      );

    assert.equal(
      netCashFlow,
      rentCollected -
        paidExpenses,
    );

    assert.ok(
      Array.isArray(
        data.properties,
      ),
    );

    assert.ok(
      Array.isArray(
        data
          .foreignCurrencyExpenses,
      ),
    );

    for (
      const property
      of data.properties
    ) {
      assert.equal(
        Number(
          property
            .netCashFlow,
        ),

        Number(
          property
            .rentCollected,
        ) -
          Number(
            property
              .paidExpenses,
          ),
      );
    }

    console.log({
      phase2B:
        "PASS",

      organisationScoped:
        true,

      accountingBasis:
        data.basis
          .accountingBasis,

      propertyCount:
        data.properties
          .length,

      netCashFlowConsistent:
        true,
    });
  },
);
