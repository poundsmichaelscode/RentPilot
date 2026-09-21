"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  apiFetch,
} from "../../lib/api";

import styles from "../management.module.css";

type Lease = {
  id: string;
  unit_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  rent_amount: string | number;
  payment_frequency: string;
  status: string;
};

type Tenant = {
  id: string;
  full_name: string;
};

type Unit = {
  id: string;
  unit_number: string;
};

type ListResponse<T> = {
  success: true;
  data: T[];
};

function money(
  value: string | number,
) {
  return new Intl.NumberFormat(
    "en-NG",
    {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    },
  ).format(Number(value));
}

export default function LeaseList() {
  const [leases, setLeases] =
    useState<Lease[]>([]);

  const [tenants, setTenants] =
    useState<Tenant[]>([]);

  const [units, setUnits] =
    useState<Unit[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [
          leaseResponse,
          tenantResponse,
          unitResponse,
        ] = await Promise.all([
          apiFetch<
            ListResponse<Lease>
          >("/leases"),

          apiFetch<
            ListResponse<Tenant>
          >("/tenants"),

          apiFetch<
            ListResponse<Unit>
          >("/units"),
        ]);

        setLeases(
          leaseResponse.data,
        );

        setTenants(
          tenantResponse.data,
        );

        setUnits(
          unitResponse.data,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load leases.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const tenantNames =
    useMemo(
      () =>
        new Map(
          tenants.map(
            (tenant) => [
              tenant.id,
              tenant.full_name,
            ],
          ),
        ),
      [tenants],
    );

  const unitNames =
    useMemo(
      () =>
        new Map(
          units.map(
            (unit) => [
              unit.id,
              unit.unit_number,
            ],
          ),
        ),
      [units],
    );

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
            <Link href="/tenants">
              Tenants
            </Link>
          </nav>
        </div>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>
              OCCUPANCY
            </span>

            <h1>Leases</h1>

            <p>
              Current and historical rental
              agreements.
            </p>
          </div>

          <Link
            className={styles.primary}
            href="/leases/new"
          >
            + Create lease
          </Link>
        </header>

        {error ? (
          <div className={styles.error}>
            {error}
          </div>
        ) : loading ? (
          <div className={styles.empty}>
            Loading leases…
          </div>
        ) : leases.length === 0 ? (
          <div className={styles.empty}>
            <p>
              No leases have been created yet.
            </p>

            <Link
              className={styles.primary}
              href="/leases/new"
            >
              Create first lease
            </Link>
          </div>
        ) : (
          <div className={styles.list}>
            {leases.map((lease) => (
              <article
                key={lease.id}
                className={styles.row}
              >
                <div>
                  <strong>
                    {tenantNames.get(
                      lease.tenant_id,
                    ) ??
                      "Tenant"}
                  </strong>

                  <small>
                    {unitNames.get(
                      lease.unit_id,
                    ) ??
                      "Unit"}
                  </small>
                </div>

                <span>
                  {money(
                    lease.rent_amount,
                  )}
                  {" · "}
                  {lease.payment_frequency}
                </span>

                <span>
                  {lease.start_date}
                  {" → "}
                  {lease.end_date}
                </span>

                <span
                  className={styles.status}
                >
                  {lease.status}
                </span>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
