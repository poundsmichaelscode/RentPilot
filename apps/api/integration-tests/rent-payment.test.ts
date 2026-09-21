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

const organisationId =
  process.env.RENT_TEST_ORGANISATION_ID;

const leaseId =
  process.env.RENT_TEST_LEASE_ID;

const actorUserId =
  process.env.RENT_TEST_ACTOR_USER_ID;

const markerPrefix =
  "PHASE_1_BATCH_B_PAYMENT_TEST:";

function requireEnv(
  name: string,
  value:
    | string
    | undefined,
) {
  if (!value) {
    throw new Error(
      `${name} is required for the remote integration test.`,
    );
  }

  return value;
}

const supabaseUrl =
  requireEnv(
    "SUPABASE_URL",
    process.env.SUPABASE_URL,
  );

const supabaseSecretKey =
  requireEnv(
    "SUPABASE_SECRET_KEY",
    process.env.SUPABASE_SECRET_KEY,
  );

const supabase =
  createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

function addDays(
  dateOnly: string,
  days: number,
) {
  const value =
    new Date(
      `${dateOnly}T00:00:00.000Z`,
    );

  value.setUTCDate(
    value.getUTCDate() +
      days,
  );

  return value
    .toISOString()
    .slice(0, 10);
}

function assertSupabaseSuccess(
  error: {
    message: string;
  } | null,
  context: string,
) {
  if (error) {
    throw new Error(
      `${context}: ${error.message}`,
    );
  }
}

type PaymentRpcResult = {
  paymentId: string;
  receiptId: string;
  receiptNumber: string;
  created: boolean;
};

async function cleanupTestData(
  orgId: string,
) {
  const {
    data: charges,
    error: chargeLookupError,
  } = await supabase
    .from("rent_charges")
    .select("id")
    .eq(
      "organisation_id",
      orgId,
    )
    .like(
      "notes",
      `${markerPrefix}%`,
    );

  assertSupabaseSuccess(
    chargeLookupError,
    "Looking up test charges for cleanup",
  );

  for (
    const charge of
    charges ?? []
  ) {
    const {
      data: payments,
      error:
        paymentLookupError,
    } = await supabase
      .from("rent_payments")
      .select("id")
      .eq(
        "organisation_id",
        orgId,
      )
      .eq(
        "rent_charge_id",
        charge.id,
      );

    assertSupabaseSuccess(
      paymentLookupError,
      "Looking up test payments for cleanup",
    );

    const paymentIds =
      (payments ?? []).map(
        (payment) =>
          payment.id,
      );

    const {
      data: reminderJobs,
      error:
        reminderLookupError,
    } = await supabase
      .from(
        "rent_reminder_jobs",
      )
      .select("id")
      .eq(
        "organisation_id",
        orgId,
      )
      .eq(
        "rent_charge_id",
        charge.id,
      );

    assertSupabaseSuccess(
      reminderLookupError,
      "Looking up reminder jobs for cleanup",
    );

    const reminderJobIds =
      (reminderJobs ?? []).map(
        (job) => job.id,
      );

    if (
      reminderJobIds.length >
      0
    ) {
      const {
        data: notifications,
        error:
          notificationLookupError,
      } = await supabase
        .from("notifications")
        .select("id")
        .eq(
          "resource_type",
          "rent_reminder_job",
        )
        .in(
          "resource_id",
          reminderJobIds,
        );

      assertSupabaseSuccess(
        notificationLookupError,
        "Looking up reminder notifications",
      );

      const notificationIds =
        (
          notifications ?? []
        ).map(
          (notification) =>
            notification.id,
        );

      if (
        notificationIds.length >
        0
      ) {
        const {
          error:
            deliveryDeleteError,
        } = await supabase
          .from(
            "notification_deliveries",
          )
          .delete()
          .in(
            "notification_id",
            notificationIds,
          );

        assertSupabaseSuccess(
          deliveryDeleteError,
          "Deleting test notification deliveries",
        );

        const {
          error:
            notificationDeleteError,
        } = await supabase
          .from(
            "notifications",
          )
          .delete()
          .in(
            "id",
            notificationIds,
          );

        assertSupabaseSuccess(
          notificationDeleteError,
          "Deleting test notifications",
        );
      }

      const {
        error:
          reminderDeleteError,
      } = await supabase
        .from(
          "rent_reminder_jobs",
        )
        .delete()
        .in(
          "id",
          reminderJobIds,
        );

      assertSupabaseSuccess(
        reminderDeleteError,
        "Deleting test reminder jobs",
      );
    }

    if (
      paymentIds.length > 0
    ) {
      /*
       * receipts.payment_id uses
       * ON DELETE RESTRICT, so receipts
       * must be deleted before payments.
       */
      const {
        error:
          receiptDeleteError,
      } = await supabase
        .from("receipts")
        .delete()
        .in(
          "payment_id",
          paymentIds,
        );

      assertSupabaseSuccess(
        receiptDeleteError,
        "Deleting test receipts",
      );

      const {
        error:
          paymentAuditDeleteError,
      } = await supabase
        .from("audit_logs")
        .delete()
        .eq(
          "organisation_id",
          orgId,
        )
        .eq(
          "resource_type",
          "rent_payment",
        )
        .in(
          "resource_id",
          paymentIds,
        );

      assertSupabaseSuccess(
        paymentAuditDeleteError,
        "Deleting payment audit logs",
      );

      const {
        error:
          paymentDeleteError,
      } = await supabase
        .from("rent_payments")
        .delete()
        .in(
          "id",
          paymentIds,
        );

      assertSupabaseSuccess(
        paymentDeleteError,
        "Deleting test payments",
      );
    }

    const {
      error:
        chargeAuditDeleteError,
    } = await supabase
      .from("audit_logs")
      .delete()
      .eq(
        "organisation_id",
        orgId,
      )
      .eq(
        "resource_type",
        "rent_charge",
      )
      .eq(
        "resource_id",
        charge.id,
      );

    assertSupabaseSuccess(
      chargeAuditDeleteError,
      "Deleting charge audit logs",
    );

    const {
      error:
        chargeDeleteError,
    } = await supabase
      .from("rent_charges")
      .delete()
      .eq(
        "id",
        charge.id,
      )
      .eq(
        "organisation_id",
        orgId,
      )
      .like(
        "notes",
        `${markerPrefix}%`,
      );

    assertSupabaseSuccess(
      chargeDeleteError,
      "Deleting test rent charge",
    );
  }
}

test(
  "record_rent_payment is idempotent and rejects overpayment",
  {
    skip:
      !RUN_REMOTE,
  },
  async () => {
    const orgId =
      requireEnv(
        "RENT_TEST_ORGANISATION_ID",
        organisationId,
      );

    const testLeaseId =
      requireEnv(
        "RENT_TEST_LEASE_ID",
        leaseId,
      );

    const actorId =
      requireEnv(
        "RENT_TEST_ACTOR_USER_ID",
        actorUserId,
      );

    /*
     * Clear residue from a previous
     * interrupted Batch B run.
     */
    await cleanupTestData(
      orgId,
    );

    const marker =
      `${markerPrefix}${Date.now()}:${randomUUID()}`;

    const idempotencyKey =
      `phase1-batch-b:${randomUUID()}`;

    let chargeId:
      | string
      | null = null;

    try {
      /*
       * Verify the actor is really
       * an active organisation member
       * before creating any fixture.
       */
      const {
        data: membership,
        error:
          membershipError,
      } = await supabase
        .from(
          "organisation_members",
        )
        .select(
          "user_id,role,is_active",
        )
        .eq(
          "organisation_id",
          orgId,
        )
        .eq(
          "user_id",
          actorId,
        )
        .eq(
          "is_active",
          true,
        )
        .maybeSingle();

      assertSupabaseSuccess(
        membershipError,
        "Checking integration-test actor",
      );

      assert.ok(
        membership,
        "Integration actor must be an active organisation member.",
      );

      assert.ok(
        [
          "OWNER",
          "ADMIN",
          "PROPERTY_MANAGER",
          "ACCOUNTANT",
        ].includes(
          membership.role,
        ),
        `Unexpected actor role: ${membership.role}`,
      );

      /*
       * Verify the lease belongs to
       * the requested organisation.
       */
      const {
        data: lease,
        error:
          leaseError,
      } = await supabase
        .from("leases")
        .select(
          "id,organisation_id,start_date,end_date",
        )
        .eq(
          "id",
          testLeaseId,
        )
        .eq(
          "organisation_id",
          orgId,
        )
        .maybeSingle();

      assertSupabaseSuccess(
        leaseError,
        "Checking integration-test lease",
      );

      assert.ok(
        lease,
        "Integration-test lease was not found in the organisation.",
      );

      const periodStart =
        lease.start_date;

      const candidateEnd =
        addDays(
          periodStart,
          1,
        );

      const periodEnd =
        candidateEnd <=
        lease.end_date
          ? candidateEnd
          : periodStart;

      /*
       * Create a uniquely marked
       * controlled rent charge.
       */
      const {
        error:
          createChargeError,
      } = await supabase.rpc(
        "create_manual_rent_charge",
        {
          p_user_id:
            actorId,

          p_organisation_id:
            orgId,

          p_lease_id:
            testLeaseId,

          p_period_start:
            periodStart,

          p_period_end:
            periodEnd,

          p_due_date:
            periodStart,

          p_expected_amount:
            1000,

          p_notes:
            marker,
        },
      );

      assertSupabaseSuccess(
        createChargeError,
        "Creating controlled rent charge",
      );

      const {
        data: charge,
        error:
          chargeLookupError,
      } = await supabase
        .from("rent_charges")
        .select(
          "id,expected_amount,waived_amount,status",
        )
        .eq(
          "organisation_id",
          orgId,
        )
        .eq(
          "notes",
          marker,
        )
        .single();

      assertSupabaseSuccess(
        chargeLookupError,
        "Looking up controlled rent charge",
      );

      chargeId =
        charge.id;

      assert.equal(
        Number(
          charge.expected_amount,
        ),
        1000,
      );

      /*
       * First call:
       * should create payment + receipt.
       */
      const {
        data:
          firstPaymentRaw,
        error:
          firstPaymentError,
      } = await supabase.rpc(
        "record_rent_payment",
        {
          p_user_id:
            actorId,

          p_organisation_id:
            orgId,

          p_lease_id:
            testLeaseId,

          p_rent_charge_id:
            chargeId,

          p_amount:
            400,

          p_payment_date:
            periodStart,

          p_payment_method:
            "BANK_TRANSFER",

          p_reference:
            "PHASE-1-BATCH-B",

          p_notes:
            marker,

          p_idempotency_key:
            idempotencyKey,
        },
      );

      assertSupabaseSuccess(
        firstPaymentError,
        "Recording first payment",
      );

      const firstPayment =
        firstPaymentRaw as PaymentRpcResult;

      assert.equal(
        firstPayment.created,
        true,
      );

      assert.ok(
        firstPayment.paymentId,
      );

      assert.ok(
        firstPayment.receiptId,
      );

      assert.ok(
        firstPayment.receiptNumber,
      );

      /*
       * Retry the exact same request.
       * It must return the existing
       * payment rather than inserting.
       */
      const {
        data:
          retryPaymentRaw,
        error:
          retryPaymentError,
      } = await supabase.rpc(
        "record_rent_payment",
        {
          p_user_id:
            actorId,

          p_organisation_id:
            orgId,

          p_lease_id:
            testLeaseId,

          p_rent_charge_id:
            chargeId,

          p_amount:
            400,

          p_payment_date:
            periodStart,

          p_payment_method:
            "BANK_TRANSFER",

          p_reference:
            "PHASE-1-BATCH-B",

          p_notes:
            marker,

          p_idempotency_key:
            idempotencyKey,
        },
      );

      assertSupabaseSuccess(
        retryPaymentError,
        "Retrying idempotent payment",
      );

      const retryPayment =
        retryPaymentRaw as PaymentRpcResult;

      assert.equal(
        retryPayment.created,
        false,
      );

      assert.equal(
        retryPayment.paymentId,
        firstPayment.paymentId,
      );

      assert.equal(
        retryPayment.receiptId,
        firstPayment.receiptId,
      );

      assert.equal(
        retryPayment.receiptNumber,
        firstPayment.receiptNumber,
      );

      /*
       * Prove only one payment exists.
       */
      const {
        count:
          idempotentPaymentCount,
        error:
          paymentCountError,
      } = await supabase
        .from("rent_payments")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        )
        .eq(
          "organisation_id",
          orgId,
        )
        .eq(
          "idempotency_key",
          idempotencyKey,
        );

      assertSupabaseSuccess(
        paymentCountError,
        "Counting idempotent payments",
      );

      assert.equal(
        idempotentPaymentCount,
        1,
      );

      /*
       * Prove only one receipt exists.
       */
      const {
        count:
          receiptCount,
        error:
          receiptCountError,
      } = await supabase
        .from("receipts")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        )
        .eq(
          "payment_id",
          firstPayment.paymentId,
        );

      assertSupabaseSuccess(
        receiptCountError,
        "Counting payment receipts",
      );

      assert.equal(
        receiptCount,
        1,
      );

      /*
       * A 400 payment against a
       * 1000 charge leaves 600.
       *
       * 700 must therefore fail.
       */
      const {
        error:
          overpaymentError,
      } = await supabase.rpc(
        "record_rent_payment",
        {
          p_user_id:
            actorId,

          p_organisation_id:
            orgId,

          p_lease_id:
            testLeaseId,

          p_rent_charge_id:
            chargeId,

          p_amount:
            700,

          p_payment_date:
            periodStart,

          p_payment_method:
            "BANK_TRANSFER",

          p_reference:
            "PHASE-1-BATCH-B-OVERPAY",

          p_notes:
            marker,

          p_idempotency_key:
            `phase1-overpay:${randomUUID()}`,
        },
      );

      assert.ok(
        overpaymentError,
        "Overpayment must be rejected.",
      );

      assert.match(
        overpaymentError.message,
        /PAYMENT_EXCEEDS_OUTSTANDING/,
      );

      /*
       * Verify the rejected operation
       * did not create a second payment.
       */
      const {
        data: finalPayments,
        error:
          finalPaymentsError,
      } = await supabase
        .from("rent_payments")
        .select("id,amount")
        .eq(
          "organisation_id",
          orgId,
        )
        .eq(
          "rent_charge_id",
          chargeId,
        );

      assertSupabaseSuccess(
        finalPaymentsError,
        "Verifying final payment state",
      );

      assert.equal(
        finalPayments?.length,
        1,
      );

      const paidTotal =
        (
          finalPayments ?? []
        ).reduce(
          (
            total,
            payment,
          ) =>
            total +
            Number(
              payment.amount,
            ),
          0,
        );

      assert.equal(
        paidTotal,
        400,
      );

      assert.equal(
        1000 -
          Number(
            charge.waived_amount ??
              0,
          ) -
          paidTotal,
        600,
      );

      /*
       * Idempotent retry must not
       * duplicate the payment audit log.
       */
      const {
        count:
          auditLogCount,
        error:
          auditCountError,
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
          orgId,
        )
        .eq(
          "resource_type",
          "rent_payment",
        )
        .eq(
          "resource_id",
          firstPayment.paymentId,
        )
        .eq(
          "action",
          "RENT_PAYMENT_RECORDED",
        );

      assertSupabaseSuccess(
        auditCountError,
        "Counting payment audit entries",
      );

      assert.equal(
        auditLogCount,
        1,
      );

      console.log({
        batchB:
          "PASS",

        paymentId:
          firstPayment.paymentId,

        receiptId:
          firstPayment.receiptId,

        outstanding:
          600,

        idempotentRetry:
          true,

        overpaymentRejected:
          true,
      });
    } finally {
      /*
       * Cleanup runs whether assertions
       * pass or fail.
       */
      await cleanupTestData(
        orgId,
      );

      const {
        count:
          remainingCharges,
        error:
          residueError,
      } = await supabase
        .from("rent_charges")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        )
        .eq(
          "organisation_id",
          orgId,
        )
        .like(
          "notes",
          `${markerPrefix}%`,
        );

      assertSupabaseSuccess(
        residueError,
        "Verifying Batch B cleanup",
      );

      assert.equal(
        remainingCharges,
        0,
        "Batch B must leave zero controlled rent charges behind.",
      );
    }
  },
);
