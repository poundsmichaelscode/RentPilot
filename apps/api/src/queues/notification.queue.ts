import {
  Queue,
} from "bullmq";

import {
  supabase,
} from "../config/supabase.js";

import {
  createRedisConnection,
} from "../config/redis.js";

export const NOTIFICATION_QUEUE =
  "rentpilot-notifications";

export type NotificationJob = {
  deliveryId: string;
};

const queueConnection =
  createRedisConnection();

export const notificationQueue =
  new Queue<NotificationJob>(
    NOTIFICATION_QUEUE,
    {
      connection:
        queueConnection,

      defaultJobOptions: {
        attempts: 5,

        backoff: {
          type: "exponential",
          delay: 5000,
        },

        removeOnComplete: {
          age: 86400,
          count: 1000,
        },

        removeOnFail: {
          age: 604800,
          count: 5000,
        },
      },
    },
  );

export type QueueEmailInput = {
  notificationId: string;
  destination: string;
};

export async function queueEmailDelivery(
  input: QueueEmailInput,
) {
  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from(
      "notification_deliveries",
    )
    .select("*")
    .eq(
      "notification_id",
      input.notificationId,
    )
    .eq(
      "channel",
      "EMAIL",
    )
    .eq(
      "destination",
      input.destination,
    )
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  let delivery =
    existing;

  if (!delivery) {
    const {
      data,
      error,
    } = await supabase
      .from(
        "notification_deliveries",
      )
      .insert({
        notification_id:
          input.notificationId,

        channel:
          "EMAIL",

        destination:
          input.destination,

        status:
          "PENDING",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    delivery = data;
  }

  if (
    delivery.status ===
      "SENT" ||
    delivery.status ===
      "CANCELLED"
  ) {
    return delivery;
  }

  const existingJob =
    await notificationQueue
      .getJob(
        delivery.id,
      );

  if (!existingJob) {
    await notificationQueue.add(
      "send-email",
      {
        deliveryId:
          delivery.id,
      },
      {
        jobId:
          delivery.id,

        attempts:
          delivery.max_attempts ??
          5,
      },
    );
  }

  const {
    data: queued,
    error: queueUpdateError,
  } = await supabase
    .from(
      "notification_deliveries",
    )
    .update({
      status:
        "QUEUED",

      queued_at:
        new Date()
          .toISOString(),

      last_error:
        null,
    })
    .eq(
      "id",
      delivery.id,
    )
    .select()
    .single();

  if (queueUpdateError) {
    throw queueUpdateError;
  }

  return queued;
}
