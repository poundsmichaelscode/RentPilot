"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import {
  apiFetch,
} from "../../lib/api";

import styles from "./notifications.module.css";

type UserRole =
  | "tenant"
  | "landlord"
  | "manager";

type NotificationType =
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

type NotificationRecord = {
  id: string;
  organisation_id: string;
  type: NotificationType;
  title: string;
  message: string;
  resource_type:
    | string
    | null;
  resource_id:
    | string
    | null;
  metadata:
    Record<string, unknown>;
  read_at:
    | string
    | null;
  created_at: string;
};

type NotificationResponse = {
  success: true;
  data: NotificationRecord[];
};

function humanize(
  value: string,
) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function destinationFor(
  role: UserRole,
  notification:
    NotificationRecord,
) {
  const tenant =
    role === "tenant";

  switch (
    notification.type
  ) {
    case "RENT_DUE_SOON":
    case "RENT_DUE_TODAY":
    case "RENT_OVERDUE":
      return tenant
        ? "/tenant/payments"
        : "/rent";

    case "PAYMENT_RECORDED":
    case "PAYMENT_RECEIPT":
      return tenant
        ? "/tenant/payments"
        : "/payments";

    case "LEASE_EXPIRING":
      return tenant
        ? "/tenant/lease"
        : "/leases";

    case "MAINTENANCE_CREATED":
    case "MAINTENANCE_UPDATED":
      return tenant
        ? "/dashboard"
        : "/maintenance";

    case "DOCUMENT_SHARED":
      return tenant
        ? "/tenant/documents"
        : "/documents";

    case "SYSTEM":
    default:
      return "/dashboard";
  }
}

function relativeTime(
  value: string,
) {
  const date =
    new Date(value);

  const difference =
    Date.now() -
    date.getTime();

  const minutes =
    Math.floor(
      difference /
        60000,
    );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes / 60,
    );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(
      hours / 24,
    );

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString(
    "en-NG",
  );
}

export default function NotificationCenter({
  role,
}: {
  role: UserRole;
}) {
  const router =
    useRouter();

  const [
    notifications,
    setNotifications,
  ] = useState<
    NotificationRecord[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const load =
    useCallback(
      async () => {
        try {
          setError(null);

          const response =
            await apiFetch<NotificationResponse>(
              "/notifications?limit=100",
            );

          setNotifications(
            response.data,
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load notifications.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    void load();
  }, [load]);

  async function openNotification(
    notification:
      NotificationRecord,
  ) {
    try {
      if (
        !notification.read_at
      ) {
        await apiFetch(
          `/notifications/${notification.id}/read`,
          {
            method:
              "PATCH",
          },
        );

        setNotifications(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                notification.id
                  ? {
                      ...item,
                      read_at:
                        new Date()
                          .toISOString(),
                    }
                  : item,
            ),
        );
      }

      router.push(
        destinationFor(
          role,
          notification,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to open notification.",
      );
    }
  }

  async function markAllRead() {
    try {
      await apiFetch(
        "/notifications/read-all",
        {
          method:
            "PATCH",
        },
      );

      const now =
        new Date()
          .toISOString();

      setNotifications(
        (current) =>
          current.map(
            (item) => ({
              ...item,
              read_at:
                item.read_at ??
                now,
            }),
          ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to mark notifications as read.",
      );
    }
  }

  const unreadCount =
    notifications.filter(
      (item) =>
        !item.read_at,
    ).length;

  return (
    <main
      className={
        styles.page
      }
    >
      <div
        className={
          styles.shell
        }
      >
        <header
          className={
            styles.topbar
          }
        >
          <Link
            href="/dashboard"
            className={
              styles.back
            }
          >
            ← Dashboard
          </Link>

          {unreadCount > 0 ? (
            <button
              type="button"
              className={
                styles.markAll
              }
              onClick={() =>
                void markAllRead()
              }
            >
              Mark all as read
            </button>
          ) : null}
        </header>

        <section
          className={
            styles.hero
          }
        >
          <div>
            <span
              className={
                styles.eyebrow
              }
            >
              NOTIFICATIONS
            </span>

            <h1>
              Stay on top of
              your rentals.
            </h1>

            <p>
              Rent reminders,
              payment updates,
              maintenance activity
              and important RENTpilot
              events.
            </p>
          </div>

          <div
            className={
              styles.unread
            }
          >
            <strong>
              {unreadCount}
            </strong>

            <span>
              unread
            </span>
          </div>
        </section>

        {error ? (
          <div
            className={
              styles.error
            }
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <div
            className={
              styles.empty
            }
          >
            Loading notifications…
          </div>
        ) : notifications.length ===
          0 ? (
          <div
            className={
              styles.empty
            }
          >
            <strong>
              You&apos;re all
              caught up.
            </strong>

            <p>
              New RENTpilot
              activity will appear
              here.
            </p>
          </div>
        ) : (
          <section
            className={
              styles.list
            }
          >
            {notifications.map(
              (
                notification,
              ) => (
                <button
                  key={
                    notification.id
                  }
                  type="button"
                  className={`${styles.item} ${
                    notification.read_at
                      ? styles.read
                      : styles.unreadItem
                  }`}
                  onClick={() =>
                    void openNotification(
                      notification,
                    )
                  }
                >
                  <span
                    className={
                      styles.indicator
                    }
                  />

                  <span
                    className={
                      styles.content
                    }
                  >
                    <span
                      className={
                        styles.itemTop
                      }
                    >
                      <span
                        className={
                          styles.type
                        }
                      >
                        {humanize(
                          notification.type,
                        )}
                      </span>

                      <span
                        className={
                          styles.time
                        }
                      >
                        {relativeTime(
                          notification.created_at,
                        )}
                      </span>
                    </span>

                    <strong>
                      {
                        notification.title
                      }
                    </strong>

                    <span
                      className={
                        styles.message
                      }
                    >
                      {
                        notification.message
                      }
                    </span>
                  </span>
                </button>
              ),
            )}
          </section>
        )}
      </div>
    </main>
  );
}
