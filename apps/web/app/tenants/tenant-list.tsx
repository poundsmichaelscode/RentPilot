"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  apiFetch,
} from "../../lib/api";

import styles from "../management.module.css";

type Tenant = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
};

type Response = {
  success: true;
  data: Tenant[];
};

export default function TenantList() {
  const [tenants, setTenants] =
    useState<Tenant[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response =
          await apiFetch<Response>(
            "/tenants",
          );

        setTenants(response.data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load tenants.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

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
            <Link href="/leases">
              Leases
            </Link>
          </nav>
        </div>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>
              PEOPLE
            </span>

            <h1>Tenants</h1>

            <p>
              Rental occupants and their
              current contact records.
            </p>
          </div>

          <Link
            className={styles.primary}
            href="/tenants/new"
          >
            + Add tenant
          </Link>
        </header>

        {error ? (
          <div className={styles.error}>
            {error}
          </div>
        ) : loading ? (
          <div className={styles.empty}>
            Loading tenants…
          </div>
        ) : tenants.length === 0 ? (
          <div className={styles.empty}>
            <p>
              No tenants have been added yet.
            </p>

            <Link
              className={styles.primary}
              href="/tenants/new"
            >
              Add your first tenant
            </Link>
          </div>
        ) : (
          <div className={styles.list}>
            {tenants.map((tenant) => (
              <article
                key={tenant.id}
                className={styles.row}
              >
                <div>
                  <strong>
                    {tenant.full_name}
                  </strong>

                  <small>
                    {tenant.email ??
                      "No email"}
                  </small>
                </div>

                <span>
                  {tenant.phone ??
                    "No phone"}
                </span>

                <span
                  className={styles.status}
                >
                  {tenant.status}
                </span>

                <Link
                  href={`/leases/new?tenantId=${tenant.id}`}
                >
                  Create lease →
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
