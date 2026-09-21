"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";

import { apiFetch } from "../../../lib/api";
import styles from "../../management.module.css";

type MaintenanceRequest = {
  id: string;
  property_id: string;
  unit_id: string | null;
  tenant_id: string | null;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type Property = {
  id: string;
  name: string;
};

type Unit = {
  id: string;
  unit_number: string;
};

type Tenant = {
  id: string;
  full_name: string;
};

type ItemResponse<T> = {
  success: true;
  data: T;
};

type ListResponse<T> = {
  success: true;
  data: T[];
};

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

const transitions: Record<
  string,
  string[]
> = {
  OPEN: [
    "IN_PROGRESS",
    "WAITING",
    "RESOLVED",
    "CANCELLED",
  ],

  IN_PROGRESS: [
    "WAITING",
    "RESOLVED",
    "CANCELLED",
  ],

  WAITING: [
    "IN_PROGRESS",
    "RESOLVED",
    "CANCELLED",
  ],

  RESOLVED: [],
  CANCELLED: [],
};

export default function MaintenanceDetail({
  maintenanceId,
}: {
  maintenanceId: string;
}) {
  const [request, setRequest] =
    useState<MaintenanceRequest | null>(
      null,
    );

  const [properties, setProperties] =
    useState<Property[]>([]);

  const [units, setUnits] =
    useState<Unit[]>([]);

  const [tenants, setTenants] =
    useState<Tenant[]>([]);

  const [
    resolutionNotes,
    setResolutionNotes,
  ] = useState("");

  const [updating, setUpdating] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);

      const [
        maintenanceResponse,
        propertyResponse,
        unitResponse,
        tenantResponse,
      ] = await Promise.all([
        apiFetch<
          ItemResponse<MaintenanceRequest>
        >(
          `/maintenance/${maintenanceId}`,
        ),

        apiFetch<ListResponse<Property>>(
          "/properties",
        ),

        apiFetch<ListResponse<Unit>>(
          "/units",
        ),

        apiFetch<ListResponse<Tenant>>(
          "/tenants",
        ),
      ]);

      setRequest(
        maintenanceResponse.data,
      );

      setResolutionNotes(
        maintenanceResponse.data
          .resolution_notes ?? "",
      );

      setProperties(
        propertyResponse.data,
      );

      setUnits(
        unitResponse.data,
      );

      setTenants(
        tenantResponse.data,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load maintenance request.",
      );
    }
  }, [maintenanceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const property = useMemo(
    () =>
      properties.find(
        (item) =>
          item.id ===
          request?.property_id,
      ),
    [properties, request],
  );

  const unit = useMemo(
    () =>
      units.find(
        (item) =>
          item.id ===
          request?.unit_id,
      ),
    [units, request],
  );

  const tenant = useMemo(
    () =>
      tenants.find(
        (item) =>
          item.id ===
          request?.tenant_id,
      ),
    [tenants, request],
  );

  async function changeStatus(
    nextStatus: string,
  ) {
    if (!request) {
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      await apiFetch(
        `/maintenance/${request.id}/status`,
        {
          method: "PATCH",

          body: JSON.stringify({
            status: nextStatus,

            resolutionNotes:
              resolutionNotes ||
              undefined,
          }),
        },
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update maintenance status.",
      );
    } finally {
      setUpdating(false);
    }
  }

  if (error && !request) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div
            className={styles.error}
          >
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!request) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          Loading maintenance request…
        </div>
      </main>
    );
  }

  const nextStatuses =
    transitions[request.status] ?? [];

  return (
    <main className={styles.page}>
      <div
        className={styles.shell}
        style={{ maxWidth: 900 }}
      >
        <div className={styles.topbar}>
          <Link
            className={styles.back}
            href="/maintenance"
          >
            ← Maintenance
          </Link>

          <nav className={styles.nav}>
            <Link href="/dashboard">
              Dashboard
            </Link>
          </nav>
        </div>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>
              {humanize(
                request.category,
              )}
            </span>

            <h1>{request.title}</h1>

            <p>
              {property?.name ??
                "Property"}

              {unit
                ? ` · Unit ${unit.unit_number}`
                : ""}

              {tenant
                ? ` · ${tenant.full_name}`
                : ""}
            </p>
          </div>

          <div>
            <strong>
              {humanize(
                request.status,
              )}
            </strong>

            <p>
              {humanize(
                request.priority,
              )}{" "}
              priority
            </p>
          </div>
        </header>

        {error ? (
          <div
            className={styles.error}
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <section
          className={styles.card}
          style={{ marginBottom: 24 }}
        >
          <span className={styles.eyebrow}>
            ISSUE
          </span>

          <p>
            {request.description}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginTop: 24,
            }}
          >
            <div>
              <small>Created</small>
              <p>
                {new Date(
                  request.created_at,
                ).toLocaleString(
                  "en-NG",
                )}
              </p>
            </div>

            <div>
              <small>
                Last updated
              </small>
              <p>
                {new Date(
                  request.updated_at,
                ).toLocaleString(
                  "en-NG",
                )}
              </p>
            </div>

            {request.resolved_at ? (
              <div>
                <small>Resolved</small>
                <p>
                  {new Date(
                    request.resolved_at,
                  ).toLocaleString(
                    "en-NG",
                  )}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section className={styles.card}>
          <span className={styles.eyebrow}>
            WORKFLOW
          </span>

          <h2>Update request status</h2>

          {nextStatuses.length === 0 ? (
            <p>
              This maintenance request
              is closed.
            </p>
          ) : (
            <>
              <label>
                Resolution / progress
                notes

                <textarea
                  rows={4}
                  maxLength={5000}
                  value={
                    resolutionNotes
                  }
                  onChange={(event) =>
                    setResolutionNotes(
                      event.target.value,
                    )
                  }
                  placeholder="Add useful progress or resolution notes."
                />
              </label>

              <div
                className={
                  styles.actions
                }
                style={{
                  marginTop: 20,
                  flexWrap: "wrap",
                }}
              >
                {nextStatuses.map(
                  (status) => (
                    <button
                      key={status}
                      type="button"
                      className={
                        status ===
                        "RESOLVED"
                          ? styles.primary
                          : styles.secondary
                      }
                      disabled={updating}
                      onClick={() =>
                        void changeStatus(
                          status,
                        )
                      }
                    >
                      {updating
                        ? "Updating..."
                        : humanize(
                            status,
                          )}
                    </button>
                  ),
                )}
              </div>
            </>
          )}

          {request.resolution_notes ? (
            <div
              style={{
                marginTop: 24,
              }}
            >
              <small>
                Current notes
              </small>

              <p>
                {
                  request.resolution_notes
                }
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
