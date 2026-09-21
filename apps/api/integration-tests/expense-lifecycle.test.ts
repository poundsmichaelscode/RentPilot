import assert from "node:assert/strict";
import {
  randomUUID,
} from "node:crypto";
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

const markerPrefix =
  "PHASE_2A_EXPENSE_TEST:";

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

function assertSuccess(
  error:
    | { message: string }
    | null,
  context: string,
) {
  if (error) {
    throw new Error(
      `${context}: ${error.message}`,
    );
  }
}

async function cleanup(
  organisationId: string,
) {
  const {
    data: expenses,
    error,
  } = await supabase
    .from("expenses")
    .select("id")
    .eq(
      "organisation_id",
      organisationId,
    )
    .like(
      "reference",
      `${markerPrefix}%`,
    );

  assertSuccess(
    error,
    "Looking up expense fixtures",
  );

  for (
    const expense of
    expenses ?? []
  ) {
    /*
     * Cleanup may need to recover from
     * an interrupted test where the
     * expense was already CANCELLED.
     *
     * Direct service-role DELETE is used
     * only for controlled test cleanup.
     */
    const {
      error: deleteError,
    } = await supabase
      .from("expenses")
      .delete()
      .eq(
        "id",
        expense.id,
      )
      .eq(
        "organisation_id",
        organisationId,
      );

    assertSuccess(
      deleteError,
      "Deleting expense fixture",
    );

    const {
      error: auditDeleteError,
    } = await supabase
      .from("audit_logs")
      .delete()
      .eq(
        "organisation_id",
        organisationId,
      )
      .eq(
        "resource_type",
        "expense",
      )
      .eq(
        "resource_id",
        expense.id,
      );

    assertSuccess(
      auditDeleteError,
      "Deleting expense audit fixture",
    );
  }
}

test(
  "expense lifecycle enforces audit, cancellation, immutability and controlled deletion",
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

    const actorUserId =
      requireEnv(
        "RENT_TEST_ACTOR_USER_ID",
        process.env
          .RENT_TEST_ACTOR_USER_ID,
      );

    await cleanup(
      organisationId,
    );

    const marker =
      `${markerPrefix}${Date.now()}:${randomUUID()}`;

    let expenseId:
      | string
      | null = null;

    try {
      /*
       * Verify the actor is an active
       * OWNER or ADMIN because the final
       * hard-delete RPC requires it.
       */
      const {
        data: membership,
        error: membershipError,
      } = await supabase
        .from(
          "organisation_members",
        )
        .select(
          "role,is_active",
        )
        .eq(
          "organisation_id",
          organisationId,
        )
        .eq(
          "user_id",
          actorUserId,
        )
        .eq(
          "is_active",
          true,
        )
        .maybeSingle();

      assertSuccess(
        membershipError,
        "Checking expense test actor",
      );

      assert.ok(
        membership,
        "Expense test actor is not an active member.",
      );

      assert.ok(
        [
          "OWNER",
          "ADMIN",
        ].includes(
          membership.role,
        ),
        `Expense test actor must be OWNER or ADMIN; received ${membership.role}.`,
      );

      /*
       * Use an existing property when
       * available. The expense model also
       * legitimately supports org-level
       * expenses with no property.
       */
      const {
        data: properties,
        error: propertyError,
      } = await supabase
        .from("properties")
        .select("id")
        .eq(
          "organisation_id",
          organisationId,
        )
        .limit(1);

      assertSuccess(
        propertyError,
        "Looking up test property",
      );

      const propertyId =
        properties?.[0]?.id ??
        null;

      const {
        data: organisation,
        error:
          organisationError,
      } = await supabase
        .from("organisations")
        .select(
          "default_currency",
        )
        .eq(
          "id",
          organisationId,
        )
        .single();

      assertSuccess(
        organisationError,
        "Looking up organisation currency",
      );

      const currency =
        organisation
          .default_currency ??
        "NGN";

      /*
       * CREATE
       */
      const {
        data: created,
        error: createError,
      } = await supabase
        .from("expenses")
        .insert({
          organisation_id:
            organisationId,

          property_id:
            propertyId,

          unit_id:
            null,

          category:
            "MAINTENANCE",

          description:
            "Phase 2A controlled expense test",

          amount:
            1000,

          currency,

          expense_date:
            new Date()
              .toISOString()
              .slice(0, 10),

          vendor_name:
            "RENTpilot Test Vendor",

          reference:
            marker,

          payment_method:
            "BANK_TRANSFER",

          status:
            "PENDING",

          notes:
            marker,

          created_by:
            actorUserId,

          updated_by:
            actorUserId,
        })
        .select("*")
        .single();

      assertSuccess(
        createError,
        "Creating controlled expense",
      );

      expenseId =
        created.id;

      assert.equal(
        created.status,
        "PENDING",
      );

      assert.equal(
        Number(created.amount),
        1000,
      );

      /*
       * Creation must produce exactly
       * one audit entry.
       */
      const {
        count: createAuditCount,
        error:
          createAuditError,
      } = await supabase
        .from("audit_logs")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        )
        .eq(
          "organisation_id",
          organisationId,
        )
        .eq(
          "resource_type",
          "expense",
        )
        .eq(
          "resource_id",
          expenseId,
        )
        .eq(
          "action",
          "EXPENSE_CREATED",
        );

      assertSuccess(
        createAuditError,
        "Checking expense create audit",
      );

      assert.equal(
        createAuditCount,
        1,
      );

      /*
       * UPDATE
       */
      const {
        data: updated,
        error: updateError,
      } = await supabase
        .from("expenses")
        .update({
          amount:
            1250,

          status:
            "PAID",

          updated_by:
            actorUserId,
        })
        .eq(
          "id",
          expenseId,
        )
        .eq(
          "organisation_id",
          organisationId,
        )
        .select("*")
        .single();

      assertSuccess(
        updateError,
        "Updating controlled expense",
      );

      assert.equal(
        Number(updated.amount),
        1250,
      );

      assert.equal(
        updated.status,
        "PAID",
      );

      /*
       * CANCEL
       */
      const {
        data: cancelled,
        error:
          cancelError,
      } = await supabase
        .from("expenses")
        .update({
          status:
            "CANCELLED",

          updated_by:
            actorUserId,

          cancelled_by:
            actorUserId,
        })
        .eq(
          "id",
          expenseId,
        )
        .eq(
          "organisation_id",
          organisationId,
        )
        .select("*")
        .single();

      assertSuccess(
        cancelError,
        "Cancelling controlled expense",
      );

      assert.equal(
        cancelled.status,
        "CANCELLED",
      );

      assert.ok(
        cancelled.cancelled_at,
      );

      /*
       * Cancelled financial records must
       * be immutable.
       */
      const {
        error:
          immutableError,
      } = await supabase
        .from("expenses")
        .update({
          amount:
            9999,

          updated_by:
            actorUserId,
        })
        .eq(
          "id",
          expenseId,
        )
        .eq(
          "organisation_id",
          organisationId,
        );

      assert.ok(
        immutableError,
        "Cancelled expense update must fail.",
      );

      assert.match(
        immutableError.message,
        /CANCELLED_EXPENSE_IMMUTABLE/,
      );

      /*
       * Verify the three expected lifecycle
       * audit actions before deletion.
       */
      const {
        data: lifecycleAudit,
        error:
          lifecycleAuditError,
      } = await supabase
        .from("audit_logs")
        .select("action")
        .eq(
          "organisation_id",
          organisationId,
        )
        .eq(
          "resource_type",
          "expense",
        )
        .eq(
          "resource_id",
          expenseId,
        );

      assertSuccess(
        lifecycleAuditError,
        "Checking expense lifecycle audit",
      );

      const actions =
        new Set(
          (
            lifecycleAudit ?? []
          ).map(
            (entry) =>
              entry.action,
          ),
        );

      assert.ok(
        actions.has(
          "EXPENSE_CREATED",
        ),
      );

      assert.ok(
        actions.has(
          "EXPENSE_UPDATED",
        ),
      );

      assert.ok(
        actions.has(
          "EXPENSE_CANCELLED",
        ),
      );

      /*
       * OWNER / ADMIN hard deletion must
       * use the controlled RPC.
       */
      const {
        data:
          deleteResult,
        error:
          deleteError,
      } = await supabase.rpc(
        "delete_expense",
        {
          p_user_id:
            actorUserId,

          p_organisation_id:
            organisationId,

          p_expense_id:
            expenseId,
        },
      );

      assertSuccess(
        deleteError,
        "Deleting controlled expense",
      );

      assert.equal(
        deleteResult.deleted,
        true,
      );

      assert.equal(
        deleteResult.expenseId,
        expenseId,
      );

      const {
        count:
          remainingExpenseCount,
        error:
          remainingExpenseError,
      } = await supabase
        .from("expenses")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        )
        .eq(
          "id",
          expenseId,
        );

      assertSuccess(
        remainingExpenseError,
        "Checking deleted expense",
      );

      assert.equal(
        remainingExpenseCount,
        0,
      );

      /*
       * Deletion itself must remain in the
       * audit trail.
       */
      const {
        count:
          deleteAuditCount,
        error:
          deleteAuditError,
      } = await supabase
        .from("audit_logs")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        )
        .eq(
          "organisation_id",
          organisationId,
        )
        .eq(
          "resource_type",
          "expense",
        )
        .eq(
          "resource_id",
          expenseId,
        )
        .eq(
          "action",
          "EXPENSE_DELETED",
        );

      assertSuccess(
        deleteAuditError,
        "Checking expense delete audit",
      );

      assert.equal(
        deleteAuditCount,
        1,
      );

      console.log({
        phase2A:
          "PASS",

        expenseLifecycle:
          true,

        auditTrail:
          true,

        cancellationImmutable:
          true,

        controlledDelete:
          true,
      });

      /*
       * Remove controlled audit records.
       * The production expense itself is
       * already gone.
       */
      const {
        error:
          auditCleanupError,
      } = await supabase
        .from("audit_logs")
        .delete()
        .eq(
          "organisation_id",
          organisationId,
        )
        .eq(
          "resource_type",
          "expense",
        )
        .eq(
          "resource_id",
          expenseId,
        );

      assertSuccess(
        auditCleanupError,
        "Cleaning controlled expense audit records",
      );

      expenseId =
        null;
    } finally {
      await cleanup(
        organisationId,
      );

      if (expenseId) {
        const {
          error:
            finalAuditCleanupError,
        } = await supabase
          .from("audit_logs")
          .delete()
          .eq(
            "organisation_id",
            organisationId,
          )
          .eq(
            "resource_type",
            "expense",
          )
          .eq(
            "resource_id",
            expenseId,
          );

        assertSuccess(
          finalAuditCleanupError,
          "Final expense audit cleanup",
        );
      }

      const {
        count: residue,
        error:
          residueError,
      } = await supabase
        .from("expenses")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        )
        .eq(
          "organisation_id",
          organisationId,
        )
        .like(
          "reference",
          `${markerPrefix}%`,
        );

      assertSuccess(
        residueError,
        "Checking expense test residue",
      );

      assert.equal(
        residue,
        0,
        "Phase 2A test must leave zero expense fixtures.",
      );
    }
  },
);
