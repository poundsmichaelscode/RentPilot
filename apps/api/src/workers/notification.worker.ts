import {
  Worker,
  type Job,
} from "bullmq";

import {
  supabase,
} from "../config/supabase.js";

import {
  createRedisConnection,
} from "../config/redis.js";

import {
  sendEmail,
} from "../services/email.service.js";

import {
  NOTIFICATION_QUEUE,
  type NotificationJob,
} from "../queues/notification.queue.js";

const workerConnection =
  createRedisConnection();

async function processNotification(
  job: Job<NotificationJob>,
) {
  const {
    data: delivery,
    error: deliveryError,
  } = await supabase
    .from(
      "notification_deliveries",
    )
    .select("*")
    .eq(
      "id",
      job.data.deliveryId,
    )
    .single();

  if (deliveryError) {
    throw deliveryError;
  }

  if (
    delivery.status ===
      "SENT" ||
    delivery.status ===
      "CANCELLED"
  ) {
    return {
      skipped: true,
      reason:
        delivery.status,
    };
  }

  const {
    data: notification,
    error: notificationError,
  } = await supabase
    .from("notifications")
    .select(
      `
      id,
      title,
      message,
      type,
      metadata
      `,
    )
    .eq(
      "id",
      delivery.notification_id,
    )
    .single();

  if (notificationError) {
    throw notificationError;
  }

  const attemptCount =
    Number(
      delivery.attempt_count ??
        0,
    ) + 1;

  const {
    error: processingError,
  } = await supabase
    .from(
      "notification_deliveries",
    )
    .update({
      status:
        "PROCESSING",

      processing_at:
        new Date()
          .toISOString(),

      attempt_count:
        attemptCount,

      last_error:
        null,
    })
    .eq(
      "id",
      delivery.id,
    );

  if (processingError) {
    throw processingError;
  }

  try {
    const result =
      await sendEmail({
        to:
          delivery.destination,

        subject:
          notification.title,

        text:
          notification.message,
      });

    const {
      error: sentError,
    } = await supabase
      .from(
        "notification_deliveries",
      )
      .update({
        status:
          "SENT",

        provider:
          result.provider,

        provider_message_id:
          result.messageId,

        sent_at:
          new Date()
            .toISOString(),

        failed_at:
          null,

        last_error:
          null,
      })
      .eq(
        "id",
        delivery.id,
      );

    if (sentError) {
      throw sentError;
    }

    return {
      delivered: true,
      provider:
        result.provider,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown email delivery error.";

    await supabase
      .from(
        "notification_deliveries",
      )
      .update({
        status:
          "FAILED",

        failed_at:
          new Date()
            .toISOString(),

        last_error:
          message,
      })
      .eq(
        "id",
        delivery.id,
      );

    throw error;
  }
}

export const notificationWorker =
  new Worker<NotificationJob>(
    NOTIFICATION_QUEUE,
    processNotification,
    {
      connection:
        workerConnection,

      concurrency: 5,
    },
  );

notificationWorker.on(
  "ready",
  () => {
    console.log(
      "Notification worker ready.",
    );
  },
);

notificationWorker.on(
  "completed",
  (job) => {
    console.log(
      `Notification job ${job.id} completed.`,
    );
  },
);

notificationWorker.on(
  "failed",
  (
    job,
    error,
  ) => {
    console.error(
      `Notification job ${job?.id ?? "unknown"} failed:`,
      error.message,
    );
  },
);
