"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  apiFetch,
} from "../../lib/api";

import styles from "./notification-bell.module.css";

type CountResponse = {
  success: true;

  data: {
    unreadCount: number;
  };
};

export default function NotificationBell() {
  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response =
          await apiFetch<CountResponse>(
            "/notifications/unread-count",
          );

        if (active) {
          setUnreadCount(
            response.data
              .unreadCount,
          );
        }
      } catch {
        /*
         * A notification count should
         * never make the dashboard fail.
         */
      }
    }

    void load();

    const interval =
      window.setInterval(
        () => {
          void load();
        },
        60000,
      );

    return () => {
      active = false;

      window.clearInterval(
        interval,
      );
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className={styles.bell}
      aria-label={
        unreadCount > 0
          ? `${unreadCount} unread notifications`
          : "Notifications"
      }
    >
      <span
        aria-hidden="true"
        className={
          styles.icon
        }
      >
        ♢
      </span>

      <span>
        Notifications
      </span>

      {unreadCount > 0 ? (
        <span
          className={
            styles.badge
          }
        >
          {unreadCount > 99
            ? "99+"
            : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
