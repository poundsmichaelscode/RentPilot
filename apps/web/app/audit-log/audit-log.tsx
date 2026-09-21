"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  apiFetch,
} from "../../lib/api";

import styles from "./audit-log.module.css";

type Actor = {
  id: string;
  email: string;
  full_name:
    | string
    | null;
  role: string;
};

type AuditRecord = {
  id: string;
  actor_id:
    | string
    | null;
  action: string;
  resource_type: string;
  resource_id:
    | string
    | null;
  summary: string;
  metadata:
    Record<string, unknown>;
  created_at: string;
  actor:
    | Actor
    | null;
};

type AuditResponse = {
  success: true;

  data: AuditRecord[];

  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
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

export default function AuditLog() {
  const [records, setRecords] =
    useState<AuditRecord[]>([]);

  const [page, setPage] =
    useState(1);

  const [
    totalPages,
    setTotalPages,
  ] = useState(1);

  const [action, setAction] =
    useState("");

  const [
    resourceType,
    setResourceType,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError(null);

        const params =
          new URLSearchParams({
            page:
              String(page),

            pageSize:
              "25",
          });

        if (action.trim()) {
          params.set(
            "action",
            action.trim(),
          );
        }

        if (
          resourceType.trim()
        ) {
          params.set(
            "resourceType",
            resourceType.trim(),
          );
        }

        try {
          const response =
            await apiFetch<AuditResponse>(
              `/audit-logs?${params.toString()}`,
            );

          setRecords(
            response.data,
          );

          setTotalPages(
            Math.max(
              response.pagination
                .totalPages,
              1,
            ),
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load audit activity.",
          );
        } finally {
          setLoading(false);
        }
      },
      [
        action,
        page,
        resourceType,
      ],
    );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Link
            href="/dashboard"
            className={styles.back}
          >
            ← Dashboard
          </Link>

          <span className={styles.security}>
            OWNER / ADMIN
          </span>
        </header>

        <section className={styles.hero}>
          <span className={styles.eyebrow}>
            SECURITY & ACTIVITY
          </span>

          <h1>
            Organisation audit log.
          </h1>

          <p>
            Review important RENTpilot
            actions, who performed them,
            and when they happened.
          </p>
        </section>

        <section className={styles.filters}>
          <label>
            <span>Action</span>

            <input
              value={action}
              placeholder="e.g. RENT_CHARGE_CREATED"
              onChange={(event) => {
                setPage(1);
                setAction(
                  event.target.value,
                );
              }}
            />
          </label>

          <label>
            <span>
              Resource type
            </span>

            <input
              value={
                resourceType
              }
              placeholder="e.g. rent_charge"
              onChange={(event) => {
                setPage(1);
                setResourceType(
                  event.target.value,
                );
              }}
            />
          </label>
        </section>

        {error ? (
          <div className={styles.error}>
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className={styles.empty}>
            Loading organisation activity…
          </div>
        ) : records.length === 0 ? (
          <div className={styles.empty}>
            No matching audit activity.
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>ACTOR</th>
                  <th>ACTION</th>
                  <th>RESOURCE</th>
                  <th>SUMMARY</th>
                </tr>
              </thead>

              <tbody>
                {records.map(
                  (record) => (
                    <tr key={record.id}>
                      <td>
                        {new Date(
                          record.created_at,
                        ).toLocaleString(
                          "en-NG",
                        )}
                      </td>

                      <td>
                        <strong>
                          {record.actor
                            ?.full_name ??
                            record.actor
                              ?.email ??
                            "System"}
                        </strong>

                        {record.actor
                          ?.email ? (
                          <small>
                            {
                              record.actor
                                .email
                            }
                          </small>
                        ) : null}
                      </td>

                      <td>
                        <span
                          className={
                            styles.action
                          }
                        >
                          {humanize(
                            record.action,
                          )}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {humanize(
                            record.resource_type,
                          )}
                        </strong>

                        {record.resource_id ? (
                          <small>
                            {record.resource_id.slice(
                              0,
                              8,
                            )}
                            …
                          </small>
                        ) : null}
                      </td>

                      <td>
                        {record.summary}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.pagination}>
          <button
            type="button"
            disabled={
              page <= 1 ||
              loading
            }
            onClick={() =>
              setPage(
                (current) =>
                  Math.max(
                    1,
                    current - 1,
                  ),
              )
            }
          >
            Previous
          </button>

          <span>
            Page {page} of{" "}
            {totalPages}
          </span>

          <button
            type="button"
            disabled={
              page >=
                totalPages ||
              loading
            }
            onClick={() =>
              setPage(
                (current) =>
                  current + 1,
              )
            }
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
