"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  apiFetch,
} from "../../../lib/api";

import styles from "../tenant.module.css";

type Lease = {
  id: string;
  tenant_id: string;
  unit_id: string;
  start_date: string;
  end_date: string;
  rent_amount: number | string;
  payment_frequency: string;
  status: string;
};

type Unit = {
  id: string;
  property_id: string;
  unit_number: string;
  unit_type: string;
  bedrooms: number | null;
  bathrooms:
    | number
    | string
    | null;
};

type Property = {
  id: string;
  name: string;
  address: string;
  city: string | null;
  state: string | null;
  country: string | null;
  property_type: string;
};

type PortalResponse = {
  success: true;

  data: {
    leases: Lease[];
    units: Unit[];
    properties: Property[];
  };
};

function money(
  value: number | string,
) {
  return new Intl.NumberFormat(
    "en-NG",
    {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    },
  ).format(
    Number(value || 0),
  );
}

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

export default function TenantLease() {
  const [data, setData] =
    useState<
      PortalResponse["data"] | null
    >(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response =
          await apiFetch<PortalResponse>(
            "/tenant-portal",
          );

        setData(response.data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your lease.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const lease =
    useMemo(() => {
      if (!data) {
        return null;
      }

      return (
        data.leases.find(
          (item) =>
            [
              "ACTIVE",
              "EXPIRING_SOON",
            ].includes(
              item.status,
            ),
        ) ??
        data.leases[0] ??
        null
      );
    }, [data]);

  const unit =
    useMemo(() => {
      if (!data || !lease) {
        return null;
      }

      return (
        data.units.find(
          (item) =>
            item.id ===
            lease.unit_id,
        ) ?? null
      );
    }, [data, lease]);

  const property =
    useMemo(() => {
      if (!data || !unit) {
        return null;
      }

      return (
        data.properties.find(
          (item) =>
            item.id ===
            unit.property_id,
        ) ?? null
      );
    }, [data, unit]);

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.loading}>
            Loading your lease…
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.error}>
            {error}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topbar}>
          <Link
            href="/dashboard"
            className={styles.back}
          >
            ← My dashboard
          </Link>

          <div className={styles.nav}>
            <Link href="/tenant/payments">
              Payments
            </Link>

            <Link href="/tenant/documents">
              Documents
            </Link>
          </div>
        </nav>

        <header className={styles.hero}>
          <span className={styles.eyebrow}>
            MY LEASE
          </span>

          <h1>
            Your tenancy at a glance.
          </h1>

          <p>
            Review your home, lease
            period and agreed rent
            details.
          </p>
        </header>

        {!lease ? (
          <div className={styles.empty}>
            No lease has been linked to
            your account yet.
          </div>
        ) : (
          <>
            <section className={styles.metrics}>
              <article
                className={
                  styles.moneyMetric
                }
              >
                <span>
                  RENT AMOUNT
                </span>

                <strong>
                  {money(
                    lease.rent_amount,
                  )}
                </strong>

                <p>
                  {humanize(
                    lease.payment_frequency,
                  )}
                </p>
              </article>

              <article
                className={
                  styles.metric
                }
              >
                <span>
                  LEASE START
                </span>

                <strong>
                  {new Date(
                    lease.start_date,
                  ).toLocaleDateString(
                    "en-NG",
                  )}
                </strong>
              </article>

              <article
                className={
                  styles.metric
                }
              >
                <span>
                  LEASE END
                </span>

                <strong>
                  {new Date(
                    lease.end_date,
                  ).toLocaleDateString(
                    "en-NG",
                  )}
                </strong>
              </article>
            </section>

            <section className={styles.section}>
              <div
                className={
                  styles.sectionHead
                }
              >
                <span
                  className={
                    styles.eyebrow
                  }
                >
                  HOME DETAILS
                </span>

                <h2>
                  {property?.name ??
                    "My home"}
                </h2>
              </div>

              <article className={styles.card}>
                <div
                  className={
                    styles.detailGrid
                  }
                >
                  <div className={styles.detail}>
                    <span>
                      LEASE STATUS
                    </span>

                    <strong
                      className={
                        styles.status
                      }
                    >
                      {humanize(
                        lease.status,
                      )}
                    </strong>
                  </div>

                  <div className={styles.detail}>
                    <span>
                      UNIT
                    </span>

                    <strong>
                      {unit
                        ? `Unit ${unit.unit_number}`
                        : "—"}
                    </strong>
                  </div>

                  <div className={styles.detail}>
                    <span>
                      UNIT TYPE
                    </span>

                    <strong>
                      {unit
                        ? humanize(
                            unit.unit_type,
                          )
                        : "—"}
                    </strong>
                  </div>

                  <div className={styles.detail}>
                    <span>
                      BED / BATH
                    </span>

                    <strong>
                      {unit
                        ? `${unit.bedrooms ?? 0} bed · ${Number(
                            unit.bathrooms ??
                              0,
                          )} bath`
                        : "—"}
                    </strong>
                  </div>

                  <div className={styles.detail}>
                    <span>
                      PROPERTY
                    </span>

                    <strong>
                      {property?.name ??
                        "—"}
                    </strong>
                  </div>

                  <div className={styles.detail}>
                    <span>
                      ADDRESS
                    </span>

                    <strong>
                      {property
                        ? [
                            property.address,
                            property.city,
                            property.state,
                          ]
                            .filter(Boolean)
                            .join(", ")
                        : "—"}
                    </strong>
                  </div>
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
