"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";

import { apiFetch } from "../../lib/api";
import styles from "../management.module.css";

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
  created_at: string;
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

export default function MaintenanceList() {
  const [requests, setRequests] =
    useState<MaintenanceRequest[]>([]);

  const [properties, setProperties] =
    useState<Property[]>([]);

  const [units, setUnits] =
    useState<Unit[]>([]);

  const [tenants, setTenants] =
    useState<Tenant[]>([]);

  const [status, setStatus] =
    useState("");

  const [priority, setPriority] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [
          maintenanceResponse,
          propertyResponse,
          unitResponse,
          tenantResponse,
        ] = await Promise.all([
          apiFetch<ListResponse<MaintenanceRequest>>(
            "/maintenance",
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

        setRequests(
          maintenanceResponse.data,
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
            : "Unable to load maintenance requests.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const propertyById = useMemo(
    () =>
      new Map(
        properties.map((property) => [
          property.id,
          property,
        ]),
      ),
    [properties],
  );

  const unitById = useMemo(
    () =>
      new Map(
        units.map((unit) => [
          unit.id,
          unit,
        ]),
      ),
    [units],
  );

  const tenantById = useMemo(
    () =>
      new Map(
        tenants.map((tenant) => [
          tenant.id,
          tenant,
        ]),
      ),
    [tenants],
  );

  const filtered = useMemo(
    () =>
      requests.filter((request) => {
        if (
          status &&
          request.status !== status
        ) {
          return false;
        }

        if (
          priority &&
          request.priority !== priority
        ) {
          return false;
        }

        return true;
      }),
    [requests, status, priority],
  );

  const openCount = requests.filter(
    (request) =>
      ![
        "RESOLVED",
        "CANCELLED",
      ].includes(request.status),
  ).length;

  const urgentCount = requests.filter(
    (request) =>
      request.priority === "URGENT" &&
      ![
        "RESOLVED",
        "CANCELLED",
      ].includes(request.status),
  ).length;

  const inProgressCount =
    requests.filter(
      (request) =>
        request.status ===
        "IN_PROGRESS",
    ).length;

  const resolvedCount = requests.filter(
    (request) =>
      request.status === "RESOLVED",
  ).length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <Link
            className={styles.back}
            href="/dashboard"
          >
            ← Dashboard
          </Link>

          <nav className={styles.nav}>
            <Link href="/properties/new">
              Properties
            </Link>

            <Link href="/tenants">
              Tenants
            </Link>

            <Link href="/leases">
              Leases
            </Link>

            <Link href="/rent">
              Rent
            </Link>
          </nav>
        </div>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>
              PROPERTY OPERATIONS
            </span>

            <h1>Maintenance</h1>

            <p>
              Track repairs, faults and
              operational issues across
              your rental portfolio.
            </p>
          </div>

          <Link
            className={styles.primary}
            href="/maintenance/new"
          >
            + New request
          </Link>
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
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <article className={styles.card}>
            <small>Open requests</small>
            <h2>{openCount}</h2>
          </article>

          <article className={styles.card}>
            <small>Urgent</small>
            <h2>{urgentCount}</h2>
          </article>

          <article className={styles.card}>
            <small>In progress</small>
            <h2>{inProgressCount}</h2>
          </article>

          <article className={styles.card}>
            <small>Resolved</small>
            <h2>{resolvedCount}</h2>
          </article>
        </section>

        <section
          className={styles.card}
          style={{ marginBottom: 24 }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <label>
              Status
              <select
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  All statuses
                </option>
                <option value="OPEN">
                  Open
                </option>
                <option value="IN_PROGRESS">
                  In progress
                </option>
                <option value="WAITING">
                  Waiting
                </option>
                <option value="RESOLVED">
                  Resolved
                </option>
                <option value="CANCELLED">
                  Cancelled
                </option>
              </select>
            </label>

            <label>
              Priority
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  All priorities
                </option>
                <option value="URGENT">
                  Urgent
                </option>
                <option value="HIGH">
                  High
                </option>
                <option value="NORMAL">
                  Normal
                </option>
                <option value="LOW">
                  Low
                </option>
              </select>
            </label>
          </div>
        </section>

        {loading ? (
          <div className={styles.empty}>
            Loading maintenance requests…
          </div>
        ) : filtered.length === 0 ? (
          <section className={styles.card}>
            <div className={styles.empty}>
              No maintenance requests
              found.
            </div>
          </section>
        ) : (
          <section className={styles.list}>
            {filtered.map((request) => {
              const property =
                propertyById.get(
                  request.property_id,
                );

              const unit = request.unit_id
                ? unitById.get(
                    request.unit_id,
                  )
                : undefined;

              const tenant =
                request.tenant_id
                  ? tenantById.get(
                      request.tenant_id,
                    )
                  : undefined;

              return (
                <article
                  key={request.id}
                  className={styles.card}
                >
                  <div
                    className={styles.header}
                  >
                    <div>
                      <span
                        className={
                          styles.eyebrow
                        }
                      >
                        {humanize(
                          request.category,
                        )}
                      </span>

                      <h2>
                        {request.title}
                      </h2>

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
                          request.priority,
                        )}
                      </strong>

                      <p>
                        {humanize(
                          request.status,
                        )}
                      </p>
                    </div>
                  </div>

                  <p>
                    {request.description}
                  </p>

                  <div
                    className={
                      styles.actions
                    }
                  >
                    <small>
                      Created{" "}
                      {new Date(
                        request.created_at,
                      ).toLocaleDateString(
                        "en-NG",
                      )}
                    </small>

                    <Link
                      href={`/maintenance/${request.id}`}
                    >
                      View request →
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
