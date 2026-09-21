import {
  supabase,
} from "../config/supabase.js";

import {
  createNotification,
} from "./notification.service.js";

import {
  queueEmailDelivery,
} from "../queues/notification.queue.js";

type ReminderType =
  | "RENT_DUE_SOON"
  | "RENT_DUE_TODAY"
  | "RENT_OVERDUE";

type ReminderCandidate = {
  type: ReminderType;
  date: string;
};

function dateOnly(
  value: Date,
) {
  return value
    .toISOString()
    .slice(0, 10);
}

function addDays(
  date: string,
  days: number,
) {
  const value =
    new Date(
      `${date}T00:00:00.000Z`,
    );

  value.setUTCDate(
    value.getUTCDate() +
      days,
  );

  return dateOnly(value);
}

function scheduledTime(
  date: string,
) {
  /*
   * 08:00 UTC is currently our MVP
   * reminder time.
   *
   * Organisation timezone support can
   * replace this later without changing
   * the job model.
   */
  return `${date}T08:00:00.000Z`;
}

function formatMoney(
  amount: number,
  currency: string,
) {
  try {
    return new Intl.NumberFormat(
      "en",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      },
    ).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

async function getPaidAmount(
  rentChargeId: string,
) {
  const {
    data,
    error,
  } = await supabase
    .from("rent_payments")
    .select("amount")
    .eq(
      "rent_charge_id",
      rentChargeId,
    );

  if (error) {
    throw error;
  }

  return (data ?? []).reduce(
    (
      total,
      payment,
    ) =>
      total +
      Number(
        payment.amount ?? 0,
      ),
    0,
  );
}

function reminderContent(
  type: ReminderType,
  input: {
    amount: number;
    currency: string;
    dueDate: string;
    tenantName: string;
  },
) {
  const amount =
    formatMoney(
      input.amount,
      input.currency,
    );

  const dueDate =
    new Date(
      `${input.dueDate}T00:00:00.000Z`,
    ).toLocaleDateString(
      "en",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      },
    );

  switch (type) {
    case "RENT_DUE_SOON":
      return {
        title:
          "Rent payment due soon",

        message:
          `Hello ${input.tenantName}, your rent balance of ${amount} is due on ${dueDate}.`,
      };

    case "RENT_DUE_TODAY":
      return {
        title:
          "Rent payment is due today",

        message:
          `Hello ${input.tenantName}, your rent balance of ${amount} is due today (${dueDate}).`,
      };

    case "RENT_OVERDUE":
      return {
        title:
          "Rent payment is overdue",

        message:
          `Hello ${input.tenantName}, your outstanding rent balance of ${amount} became due on ${dueDate}.`,
      };
  }
}

/*
 * Generate only today's reminder event.
 *
 * Due soon: 3 days before due date.
 * Due today: due date.
 * Overdue: 1 day after due date.
 *
 * The DB unique constraint makes this
 * safe to run repeatedly.
 */
export async function generateRentReminderJobs() {
  const today =
    dateOnly(
      new Date(),
    );

  const searchFrom =
    addDays(
      today,
      -1,
    );

  const searchTo =
    addDays(
      today,
      3,
    );

  const {
    data: charges,
    error,
  } = await supabase
    .from("rent_charges")
    .select(`
      id,
      organisation_id,
      lease_id,
      due_date,
      expected_amount,
      waived_amount
    `)
    .gte(
      "due_date",
      searchFrom,
    )
    .lte(
      "due_date",
      searchTo,
    );

  if (error) {
    throw error;
  }

  let created = 0;

  for (
    const charge of
    charges ?? []
  ) {
    const paidAmount =
      await getPaidAmount(
        charge.id,
      );

    const outstanding =
      Math.max(
        0,
        Number(
          charge.expected_amount ??
            0,
        ) -
          Number(
            charge.waived_amount ??
              0,
          ) -
          paidAmount,
      );

    if (outstanding <= 0) {
      continue;
    }

    const dueDate =
      charge.due_date;

    const candidates:
      ReminderCandidate[] = [
        {
          type:
            "RENT_DUE_SOON",
          date:
            addDays(
              dueDate,
              -3,
            ),
        },
        {
          type:
            "RENT_DUE_TODAY",
          date:
            dueDate,
        },
        {
          type:
            "RENT_OVERDUE",
          date:
            addDays(
              dueDate,
              1,
            ),
        },
      ];

    const candidate =
      candidates.find(
        (item) =>
          item.date ===
          today,
      );

    if (!candidate) {
      continue;
    }

    const {
      data: lease,
      error: leaseError,
    } = await supabase
      .from("leases")
      .select(
        "id,tenant_id",
      )
      .eq(
        "id",
        charge.lease_id,
      )
      .maybeSingle();

    if (leaseError) {
      throw leaseError;
    }

    if (!lease) {
      continue;
    }

    const {
      data: tenant,
      error: tenantError,
    } = await supabase
      .from("tenants")
      .select(
        "id,profile_id",
      )
      .eq(
        "id",
        lease.tenant_id,
      )
      .maybeSingle();

    if (tenantError) {
      throw tenantError;
    }

    if (
      !tenant ||
      !tenant.profile_id
    ) {
      continue;
    }

    const scheduledFor =
      scheduledTime(
        today,
      );

    const {
      data: existing,
      error:
        existingError,
    } = await supabase
      .from(
        "rent_reminder_jobs",
      )
      .select("id")
      .eq(
        "rent_charge_id",
        charge.id,
      )
      .eq(
        "reminder_type",
        candidate.type,
      )
      .eq(
        "scheduled_for",
        scheduledFor,
      )
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      continue;
    }

    const {
      error: insertError,
    } = await supabase
      .from(
        "rent_reminder_jobs",
      )
      .insert({
        organisation_id:
          charge.organisation_id,

        rent_charge_id:
          charge.id,

        tenant_id:
          tenant.id,

        recipient_user_id:
          tenant.profile_id,

        reminder_type:
          candidate.type,

        scheduled_for:
          scheduledFor,
      });

    if (
      insertError &&
      insertError.code !==
        "23505"
    ) {
      throw insertError;
    }

    if (!insertError) {
      created += 1;
    }
  }

  return {
    created,
  };
}

export async function processRentReminderJobs() {
  const now =
    new Date()
      .toISOString();

  const {
    data: jobs,
    error,
  } = await supabase
    .from(
      "rent_reminder_jobs",
    )
    .select(`
      id,
      organisation_id,
      rent_charge_id,
      tenant_id,
      recipient_user_id,
      reminder_type,
      scheduled_for
    `)
    .is(
      "processed_at",
      null,
    )
    .is(
      "cancelled_at",
      null,
    )
    .lte(
      "scheduled_for",
      now,
    )
    .order(
      "scheduled_for",
      {
        ascending: true,
      },
    )
    .limit(50);

  if (error) {
    throw error;
  }

  let processed = 0;

  for (
    const job of jobs ?? []
  ) {
    if (
      !job.recipient_user_id
    ) {
      continue;
    }

    const {
      data: charge,
      error: chargeError,
    } = await supabase
      .from("rent_charges")
      .select(`
        id,
        due_date,
        expected_amount,
        waived_amount,
        lease_id
      `)
      .eq(
        "id",
        job.rent_charge_id,
      )
      .maybeSingle();

    if (chargeError) {
      throw chargeError;
    }

    const paidAmount =
      charge
        ? await getPaidAmount(
            charge.id,
          )
        : 0;

    const outstanding =
      charge
        ? Math.max(
            0,
            Number(
              charge.expected_amount ??
                0,
            ) -
              Number(
                charge.waived_amount ??
                  0,
              ) -
              paidAmount,
          )
        : 0;

    /*
     * Do not remind a tenant after the
     * balance has already been settled.
     */
    if (
      !charge ||
      outstanding <= 0
    ) {
      await supabase
        .from(
          "rent_reminder_jobs",
        )
        .update({
          cancelled_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          job.id,
        );

      continue;
    }

    const {
      data: tenant,
      error: tenantError,
    } = await supabase
      .from("tenants")
      .select(
        "id,full_name,profile_id",
      )
      .eq(
        "id",
        job.tenant_id,
      )
      .maybeSingle();

    if (tenantError) {
      throw tenantError;
    }

    if (!tenant) {
      continue;
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        "id,email",
      )
      .eq(
        "id",
        job.recipient_user_id,
      )
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (
      !profile?.email
    ) {
      continue;
    }

    const {
      data: organisation,
      error:
        organisationError,
    } = await supabase
      .from("organisations")
      .select(
        "id,default_currency",
      )
      .eq(
        "id",
        job.organisation_id,
      )
      .maybeSingle();

    if (
      organisationError
    ) {
      throw organisationError;
    }

    const currency =
      organisation?.default_currency ??
      "NGN";

    const content =
      reminderContent(
        job.reminder_type,
        {
          amount:
            outstanding,

          currency,

          dueDate:
            charge.due_date,

          tenantName:
            tenant.full_name ??
            "Tenant",
        },
      );

    const {
      data:
        existingNotification,
      error:
        notificationLookupError,
    } = await supabase
      .from("notifications")
      .select("id")
      .eq(
        "recipient_user_id",
        profile.id,
      )
      .eq(
        "type",
        job.reminder_type,
      )
      .eq(
        "resource_type",
        "rent_reminder_job",
      )
      .eq(
        "resource_id",
        job.id,
      )
      .maybeSingle();

    if (
      notificationLookupError
    ) {
      throw notificationLookupError;
    }

    let notificationId =
      existingNotification?.id;

    if (!notificationId) {
      try {
        const notification =
          await createNotification({
            organisationId:
              job.organisation_id,

            recipientUserId:
              profile.id,

            type:
              job.reminder_type,

            title:
              content.title,

            message:
              content.message,

            resourceType:
              "rent_reminder_job",

            resourceId:
              job.id,

            metadata: {
              rentChargeId:
                charge.id,

              dueDate:
                charge.due_date,

              balance:
                outstanding,
            },
          });

        notificationId =
          notification.id;
      } catch (error) {
        const candidate =
          error as {
            code?: string;
          };

        if (
          candidate.code !==
          "23505"
        ) {
          throw error;
        }

        const {
          data: raced,
          error:
            racedError,
        } = await supabase
          .from(
            "notifications",
          )
          .select("id")
          .eq(
            "recipient_user_id",
            profile.id,
          )
          .eq(
            "type",
            job.reminder_type,
          )
          .eq(
            "resource_type",
            "rent_reminder_job",
          )
          .eq(
            "resource_id",
            job.id,
          )
          .single();

        if (racedError) {
          throw racedError;
        }

        notificationId =
          raced.id;
      }
    }

    if (!notificationId) {
      throw new Error(
        "Unable to resolve rent reminder notification.",
      );
    }

    await queueEmailDelivery({
      notificationId,
      destination:
        profile.email,
    });

    const {
      error:
        processedError,
    } = await supabase
      .from(
        "rent_reminder_jobs",
      )
      .update({
        processed_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        job.id,
      );

    if (processedError) {
      throw processedError;
    }

    processed += 1;
  }

  return {
    processed,
  };
}

export async function runRentReminderCycle() {
  const generated =
    await generateRentReminderJobs();

  const processed =
    await processRentReminderJobs();

  return {
    generated:
      generated.created,

    processed:
      processed.processed,
  };
}
