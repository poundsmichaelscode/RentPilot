"use client";

import Link from "next/link";
import NotificationBell from "./notification-bell";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiFetch } from "../../lib/api";
import styles from "../management.module.css";

type Property = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string;
};

type Unit = {
  id: string;
  property_id: string;
  unit_number: string;
  status: string;
};

type Tenant = {
  id: string;
  full_name: string;
  email?: string | null;
  status: string;
};

type Lease = {
  id: string;
  unit_id: string;
  tenant_id: string;
  rent_amount: number | string;
  payment_frequency: string;
  status: string;
  start_date: string;
  end_date: string;
};

type RentCharge = {
  id: string;
  lease_id: string;
  due_date: string;
  expected_amount: number | string;
  paid_amount: number | string;
  balance: number | string;
  status: string;
};

type RentPayment = {
  id: string;
  lease_id: string;
  rent_charge_id?: string | null;
  amount: number | string;
  payment_date: string;
  payment_method: string;
  reference?: string | null;
};

type MaintenanceRequest = {
  id: string;
  title: string;
  status: string;
  priority: string;
  property_id: string;
  unit_id: string | null;
  created_at: string;
};

type ListResponse<T> = {
  success: true;
  data: T[];
};

type DashboardProps = {
  user: {
    displayName: string;
    email: string;
  };
  signOut: string;
  initialRole: string | null;
};

function money(value: number | string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

export default function Dashboard({
  user,
  signOut,
}: DashboardProps) {
  const [properties, setProperties] =
    useState<Property[]>([]);

  const [units, setUnits] =
    useState<Unit[]>([]);

  const [tenants, setTenants] =
    useState<Tenant[]>([]);

  const [leases, setLeases] =
    useState<Lease[]>([]);

  const [charges, setCharges] =
    useState<RentCharge[]>([]);

  const [payments, setPayments] =
    useState<RentPayment[]>([]);

  const [maintenance, setMaintenance] =
    useState<MaintenanceRequest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const loadDashboard = useCallback(
    async () => {
      try {
        setError(null);

        const [
          propertyResponse,
          unitResponse,
          tenantResponse,
          leaseResponse,
          chargeResponse,
          paymentResponse,
          maintenanceResponse,
        ] = await Promise.all([
          apiFetch<ListResponse<Property>>(
            "/properties",
          ),
          apiFetch<ListResponse<Unit>>(
            "/units",
          ),
          apiFetch<ListResponse<Tenant>>(
            "/tenants",
          ),
          apiFetch<ListResponse<Lease>>(
            "/leases",
          ),
          apiFetch<ListResponse<RentCharge>>(
            "/rent-charges",
          ),
          apiFetch<ListResponse<RentPayment>>(
            "/rent-payments",
          ),

          apiFetch<ListResponse<MaintenanceRequest>>(
            "/maintenance",
          ),
        ]);

        setProperties(
          propertyResponse.data,
        );

        setUnits(
          unitResponse.data,
        );

        setTenants(
          tenantResponse.data,
        );

        setLeases(
          leaseResponse.data,
        );

        setCharges(
          chargeResponse.data,
        );

        setPayments(
          paymentResponse.data,
        );

        setMaintenance(
          maintenanceResponse.data,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your RentPilot workspace.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const activeLeases = useMemo(
    () =>
      leases.filter((lease) =>
        [
          "ACTIVE",
          "EXPIRING_SOON",
        ].includes(lease.status),
      ),
    [leases],
  );

  const occupiedUnits = useMemo(
    () =>
      units.filter(
        (unit) =>
          unit.status === "OCCUPIED",
      ),
    [units],
  );

  const vacantUnits = useMemo(
    () =>
      units.filter(
        (unit) =>
          unit.status === "VACANT",
      ),
    [units],
  );

  const outstandingCharges = useMemo(
    () =>
      charges.filter(
        (charge) =>
          !["PAID", "WAIVED"].includes(
            charge.status,
          ),
      ),
    [charges],
  );

  const overdueCharges = useMemo(
    () =>
      charges.filter(
        (charge) =>
          charge.status === "OVERDUE",
      ),
    [charges],
  );

  const totalOutstanding = useMemo(
    () =>
      outstandingCharges.reduce(
        (sum, charge) =>
          sum +
          Number(
            charge.balance || 0,
          ),
        0,
      ),
    [outstandingCharges],
  );

  const totalOverdue = useMemo(
    () =>
      overdueCharges.reduce(
        (sum, charge) =>
          sum +
          Number(
            charge.balance || 0,
          ),
        0,
      ),
    [overdueCharges],
  );

  const totalCollected = useMemo(
    () =>
      payments.reduce(
        (sum, payment) =>
          sum +
          Number(
            payment.amount || 0,
          ),
        0,
      ),
    [payments],
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

  const propertyById = useMemo(
    () =>
      new Map(
        properties.map(
          (property) => [
            property.id,
            property,
          ],
        ),
      ),
    [properties],
  );

  const leaseById = useMemo(
    () =>
      new Map(
        leases.map((lease) => [
          lease.id,
          lease,
        ]),
      ),
    [leases],
  );

  const recentPayments = useMemo(
    () =>
      [...payments]
        .sort(
          (a, b) =>
            new Date(
              b.payment_date,
            ).getTime() -
            new Date(
              a.payment_date,
            ).getTime(),
        )
        .slice(0, 5),
    [payments],
  );

  const openMaintenance = useMemo(
    () =>
      maintenance.filter(
        (request) =>
          ![
            "RESOLVED",
            "CANCELLED",
          ].includes(request.status),
      ),
    [maintenance],
  );

  const urgentMaintenance = useMemo(
    () =>
      maintenance.filter(
        (request) =>
          request.priority === "URGENT" &&
          ![
            "RESOLVED",
            "CANCELLED",
          ].includes(request.status),
      ),
    [maintenance],
  );

  const inProgressMaintenance = useMemo(
    () =>
      maintenance.filter(
        (request) =>
          request.status === "IN_PROGRESS",
      ),
    [maintenance],
  );

  const occupancyRate =
    units.length > 0
      ? Math.round(
          (occupiedUnits.length /
            units.length) *
            100,
        )
      : 0;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <Link
            className={styles.back}
            href="/"
          >
            RentPilot
          </Link>

          <nav className={styles.nav}>
            <Link href="/properties/new">
              Add property
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

            <Link href="/payments">
              Payments
            </Link>

            <NotificationBell />

            <form
              action={signOut}
              method="post"
            >
              <button
                type="submit"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>

        <header
          className={`${styles.header} ${styles.dashboardHero}`}
        >
          <div>
            <span
              className={styles.eyebrow}
            >
              PORTFOLIO OVERVIEW
            </span>

            <h1>
              Welcome back,{" "}
              {user.displayName}.
            </h1>

            <p>
              See the health of your
              rental portfolio and the
              actions that need your
              attention.
            </p>
          </div>

          <Link
            className={styles.primary}
            href="/properties/new"
          >
            + Add property
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

        {loading ? (
          <section
            className={styles.card}
          >
            <div
              className={styles.empty}
            >
              Loading portfolio…
            </div>
          </section>
        ) : (
          <>
            <section
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(190px, 1fr))",
                gap: 16,
                marginBottom: 28,
              }}
            >
              <article
                className={styles.card}
              >
                <small>
                  Properties
                </small>

                <h2>
                  {properties.length}
                </h2>

                <p>
                  {units.length} total
                  units
                </p>
              </article>

              <article
                className={styles.card}
              >
                <small>
                  Occupancy
                </small>

                <h2>
                  {occupancyRate}%
                </h2>

                <p>
                  {occupiedUnits.length}{" "}
                  occupied ·{" "}
                  {vacantUnits.length}{" "}
                  vacant
                </p>
              </article>

              <article
                className={styles.card}
              >
                <small>
                  Active leases
                </small>

                <h2>
                  {
                    activeLeases.length
                  }
                </h2>

                <p>
                  {tenants.length} tenant
                  records
                </p>
              </article>

              <article
                className={styles.card}
              >
                <small>
                  Outstanding rent
                </small>

                <h2>
                  {money(
                    totalOutstanding,
                  )}
                </h2>

                <p>
                  {
                    outstandingCharges.length
                  }{" "}
                  open charges
                </p>
              </article>

              <article
                className={styles.card}
              >
                <small>
                  Overdue rent
                </small>

                <h2>
                  {money(
                    totalOverdue,
                  )}
                </h2>

                <p>
                  {
                    overdueCharges.length
                  }{" "}
                  overdue charges
                </p>
              </article>

              <article
                className={styles.card}
              >
                <small>
                  Recorded payments
                </small>

                <h2>
                  {money(
                    totalCollected,
                  )}
                </h2>

                <p>
                  {payments.length} payment
                  records
                </p>
              </article>

              <article
                className={styles.card}
              >
                <small>
                  Open maintenance
                </small>

                <h2>
                  {openMaintenance.length}
                </h2>

                <p>
                  {urgentMaintenance.length} urgent ·{" "}
                  {inProgressMaintenance.length} in progress
                </p>
              </article>
            </section>

            <section
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 24,
              }}
            >
              <article
                className={styles.card}
              >
                <div
                  className={
                    styles.header
                  }
                >
                  <div>
                    <span
                      className={
                        styles.eyebrow
                      }
                    >
                      ACTION CENTER
                    </span>

                    <h2>
                      Overdue rent
                    </h2>
                  </div>

                  <Link href="/rent">
                    View rent →
                  </Link>
                </div>

                {overdueCharges.length ===
                0 ? (
                  <div
                    className={
                      styles.empty
                    }
                  >
                    No overdue rent.
                  </div>
                ) : (
                  <div
                    className={
                      styles.list
                    }
                  >
                    {overdueCharges
                      .slice(0, 5)
                      .map((charge) => {
                        const lease =
                          leaseById.get(
                            charge.lease_id,
                          );

                        const tenant =
                          lease
                            ? tenantById.get(
                                lease.tenant_id,
                              )
                            : undefined;

                        const unit =
                          lease
                            ? unitById.get(
                                lease.unit_id,
                              )
                            : undefined;

                        const property =
                          unit
                            ? propertyById.get(
                                unit.property_id,
                              )
                            : undefined;

                        return (
                          <div
                            key={
                              charge.id
                            }
                            className={
                              styles.row
                            }
                          >
                            <div>
                              <strong>
                                {tenant?.full_name ??
                                  "Tenant"}
                              </strong>

                              <small>
                                {property?.name ??
                                  "Property"}
                                {unit
                                  ? ` · Unit ${unit.unit_number}`
                                  : ""}
                              </small>
                            </div>

                            <div>
                              <strong>
                                {money(
                                  charge.balance,
                                )}
                              </strong>

                              <small>
                                Due{" "}
                                {
                                  charge.due_date
                                }
                              </small>
                            </div>

                            <Link
                              href={`/payments/new?chargeId=${charge.id}`}
                            >
                              Record payment
                              →
                            </Link>
                          </div>
                        );
                      })}
                  </div>
                )}
              </article>

              <article
                className={styles.card}
              >
                <div
                  className={
                    styles.header
                  }
                >
                  <div>
                    <span
                      className={
                        styles.eyebrow
                      }
                    >
                      RECENT ACTIVITY
                    </span>

                    <h2>
                      Rent payments
                    </h2>
                  </div>

                  <Link href="/payments">
                    All payments →
                  </Link>
                </div>

                {recentPayments.length ===
                0 ? (
                  <div
                    className={
                      styles.empty
                    }
                  >
                    No payments recorded
                    yet.
                  </div>
                ) : (
                  <div
                    className={
                      styles.list
                    }
                  >
                    {recentPayments.map(
                      (payment) => {
                        const lease =
                          leaseById.get(
                            payment.lease_id,
                          );

                        const tenant =
                          lease
                            ? tenantById.get(
                                lease.tenant_id,
                              )
                            : undefined;

                        return (
                          <div
                            key={
                              payment.id
                            }
                            className={
                              styles.row
                            }
                          >
                            <div>
                              <strong>
                                {tenant?.full_name ??
                                  "Tenant"}
                              </strong>

                              <small>
                                {
                                  payment.payment_date
                                }
                              </small>
                            </div>

                            <strong>
                              {money(
                                payment.amount,
                              )}
                            </strong>

                            <span>
                              {humanize(
                                payment.payment_method,
                              )}
                            </span>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </article>
            </section>

            <section
              className={styles.card}
              style={{
                marginTop: 24,
              }}
            >
              <div
                className={
                  styles.header
                }
              >
                <div>
                  <span
                    className={
                      styles.eyebrow
                    }
                  >
                    WORKSPACE
                  </span>

                  <h2>
                    Manage your rental
                    operations
                  </h2>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                <Link
                  className={
                    styles.secondary
                  }
                  href="/properties/new"
                >
                  Add property
                </Link>

                <Link
                  className={
                    styles.secondary
                  }
                  href="/tenants"
                >
                  Manage tenants
                </Link>

                <Link
                  className={
                    styles.secondary
                  }
                  href="/leases"
                >
                  Manage leases
                </Link>

                <Link
                  className={
                    styles.secondary
                  }
                  href="/rent"
                >
                  Rent & overdue
                </Link>

                <Link
                  className={
                    styles.secondary
                  }
                  href="/payments/new"
                >
                  Record payment
                </Link>

                <Link
                  className={
                    styles.secondary
                  }
                  href="/payments"
                >
                  Payment history
                </Link>

                <Link
                  className={
                    styles.secondary
                  }
                  href="/maintenance"
                >
                  Maintenance
                </Link>

                <Link
                  className={
                    styles.secondary
                  }
                  href="/documents"
                >
                  Documents
                </Link>
              </div>
            </section>
          </>
        )}

        <footer
          style={{
            marginTop: 30,
            opacity: 0.65,
            fontSize: 13,
          }}
        >
          Signed in as {user.email}
        </footer>
      </div>
    </main>
  );
}
