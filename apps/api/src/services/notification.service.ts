import {
  supabase,
} from "../config/supabase.js";

export type CreateNotificationInput = {
  organisationId: string;
  recipientUserId: string;

  actorUserId?: string | null;

  type:
    | "RENT_DUE_SOON"
    | "RENT_DUE_TODAY"
    | "RENT_OVERDUE"
    | "PAYMENT_RECORDED"
    | "PAYMENT_RECEIPT"
    | "LEASE_EXPIRING"
    | "MAINTENANCE_CREATED"
    | "MAINTENANCE_UPDATED"
    | "DOCUMENT_SHARED"
    | "SYSTEM";

  title: string;
  message: string;

  resourceType?: string | null;
  resourceId?: string | null;

  metadata?: Record<
    string,
    unknown
  >;
};

export async function createNotification(
  input: CreateNotificationInput,
) {
  const {
    data,
    error,
  } = await supabase
    .from("notifications")
    .insert({
      organisation_id:
        input.organisationId,

      recipient_user_id:
        input.recipientUserId,

      actor_user_id:
        input.actorUserId ??
        null,

      type:
        input.type,

      title:
        input.title,

      message:
        input.message,

      resource_type:
        input.resourceType ??
        null,

      resource_id:
        input.resourceId ??
        null,

      metadata:
        input.metadata ??
        {},
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
