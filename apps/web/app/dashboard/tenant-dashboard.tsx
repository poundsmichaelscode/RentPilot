"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import NotificationBell from "./notification-bell";

import { apiFetch } from "../../lib/api";
import styles from "./tenant-dashboard.module.css";

type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
};

type Tenant = {
  id: string;
  full_name: string;
};

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
  bathrooms: number | string | null;
};

type Property = {
  id: string;
  name: string;
  address: string;
  city: string | null;
  state: string | null;
  property_type: string;
};

type Charge = {
  id: string;
  lease_id: string;
  due_date: string;
  expected_amount: number | string;
  paid_amount: number | string;
  balance: number | string;
  status: string;
};

type Payment = {
  id: string;
  lease_id: string;
  amount: number | string;
  payment_date: string;
  payment_method: string;
};

type Receipt = {
  id: string;
  payment_id: string;
  receipt_number: string;
};

type Maintenance = {
  id: string;
  title: string;
  priority: string;
  status: string;
  created_at: string;
};

type DocumentRecord = {
  id: string;
  title: string;
  document_type: string;
  created_at: string;
};

type PortalResponse = {
  success: true;

  data: {
    profile: Profile;
    tenants: Tenant[];
    leases: Lease[];
    units: Unit[];
    properties: Property[];
    charges: Charge[];
    payments: Payment[];
    receipts: Receipt[];
    maintenance: Maintenance[];
    documents: DocumentRecord[];
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
  ).format(Number(value || 0));
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

export default function TenantDashboard({
  user,
  signOut,
}: {
  user: {
    displayName: string;
    email: string;
  };
  signOut: string;
}) {
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
            : "Unable to load your tenant portal.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const currentLease =
    useMemo(() => {
      if (!data) {
        return null;
      }

      return (
        data.leases.find(
          (lease) =>
            [
              "ACTIVE",
              "EXPIRING_SOON",
            ].includes(
              lease.status,
            ),
        ) ??
        data.leases[0] ??
        null
      );
    }, [data]);

  const currentUnit =
    useMemo(() => {
      if (
        !data ||
        !currentLease
      ) {
        return null;
      }

      return (
        data.units.find(
          (unit) =>
            unit.id ===
            currentLease.unit_id,
        ) ?? null
      );
    }, [data, currentLease]);

  const currentProperty =
    useMemo(() => {
      if (
        !data ||
        !currentUnit
      ) {
        return null;
      }

      return (
        data.properties.find(
          (property) =>
            property.id ===
            currentUnit.property_id,
        ) ?? null
      );
    }, [data, currentUnit]);

  const nextCharge =
    useMemo(() => {
      if (!data) {
        return null;
      }

      return (
        data.charges
          .filter(
            (charge) =>
              ![
                "PAID",
                "WAIVED",
              ].includes(
                charge.status,
              ),
          )
          .sort(
            (a, b) =>
              new Date(
                a.due_date,
              ).getTime() -
              new Date(
                b.due_date,
              ).getTime(),
          )[0] ?? null
      );
    }, [data]);

  const openMaintenance =
    useMemo(
      () =>
        data?.maintenance.filter(
          (request) =>
            ![
              "RESOLVED",
              "CANCELLED",
            ].includes(
              request.status,
            ),
        ) ?? [],
      [data],
    );

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.loading}>
            Preparing your home portal…
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

  if (!data) {
    return null;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topbar}>
          <Link
            href="/"
            className={styles.brand}
          >
            <span>R</span>
            RentPilot
          </Link>

          <div className={styles.nav}>
            <span>
              {user.email}
            </span>

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
          </div>
        </nav>

        <header className={styles.hero}>
          <div>
            <span
              className={
                styles.eyebrow
              }
            >
              MY HOME
            </span>

            <h1>
              Welcome home,{" "}
              {user.displayName}.
            </h1>

            {currentProperty ? (
              <>
                <p
                  className={
                    styles.propertyName
                  }
                >
                  {
                    currentProperty.name
                  }
                </p>

                <p
                  className={
                    styles.address
                  }
                >
                  {
                    currentProperty.address
                  }
                  {currentProperty.city
                    ? `, ${currentProperty.city}`
                    : ""}
                  {currentProperty.state
                    ? `, ${currentProperty.state}`
                    : ""}
                </p>
              </>
            ) : (
              <p>
                Your landlord has not
                linked a property to
                this account yet.
              </p>
            )}
          </div>

          {currentUnit ? (
            <div className={styles.unitBadge}>
              <small>
                YOUR UNIT
              </small>

              <strong>
                Unit{" "}
                {
                  currentUnit.unit_number
                }
              </strong>

              <span>
                {humanize(
                  currentUnit.unit_type,
                )}
              </span>
            </div>
          ) : null}
        </header>

        {!currentLease ? (
          <section
            className={styles.notice}
          >
            <strong>
              Your account is ready.
            </strong>

            <p>
              No active lease has been
              linked to your tenant
              profile yet. Ask your
              landlord or property
              manager to connect your
              RentPilot account.
            </p>
          </section>
        ) : (
          <>
            <section className={styles.metrics}>
              <article
                className={
                  styles.paymentCard
                }
              >
                <span>
                  NEXT RENT DUE
                </span>

                <strong>
                  {nextCharge
                    ? money(
                        nextCharge.balance,
                      )
                    : "No balance due"}
                </strong>

                <p>
                  {nextCharge
                    ? `Due ${new Date(
                        nextCharge.due_date,
                      ).toLocaleDateString(
                        "en-NG",
                      )}`
                    : "Your rent account is currently clear."}
                </p>

                {nextCharge ? (
                  <span
                    className={
                      nextCharge.status ===
                      "OVERDUE"
                        ? styles.overdue
                        : styles.current
                    }
                  >
                    {humanize(
                      nextCharge.status,
                    )}
                  </span>
                ) : null}
              </article>

              <article
                className={
                  styles.metricCard
                }
              >
                <span>
                  MY RENT
                </span>

                <strong>
                  {money(
                    currentLease.rent_amount,
                  )}
                </strong>

                <p>
                  {humanize(
                    currentLease.payment_frequency,
                  )}{" "}
                  lease payment
                </p>
              </article>

              <article
                className={
                  styles.metricCard
                }
              >
                <span>
                  LEASE ENDS
                </span>

                <strong
                  className={
                    styles.dateValue
                  }
                >
                  {new Date(
                    currentLease.end_date,
                  ).toLocaleDateString(
                    "en-NG",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    },
                  )}
                </strong>

                <p>
                  {humanize(
                    currentLease.status,
                  )}
                </p>
              </article>

              <article
                className={
                  styles.metricCard
                }
              >
                <span>
                  MAINTENANCE
                </span>

                <strong>
                  {
                    openMaintenance.length
                  }
                </strong>

                <p>
                  Open requests
                </p>
              </article>
            </section>

            <section
              className={
                styles.quickActions
              }
            >
              <div>
                <span
                  className={
                    styles.eyebrow
                  }
                >
                  QUICK ACTIONS
                </span>

                <h2>
                  What do you need today?
                </h2>
              </div>

              <div
                className={
                  styles.actionGrid
                }
              >
                <Link href="/tenant/maintenance/new">
                  <b>Report an issue</b>
                  <span>
                    Tell your landlord
                    about a repair
                  </span>
                </Link>

                <Link href="/tenant/payments">
                  <b>
                    Payment history
                  </b>
                  <span>
                    See payments and
                    receipts
                  </span>
                </Link>

                <Link href="/tenant/lease">
                  <b>My lease</b>
                  <span>
                    View lease details
                  </span>
                </Link>

                <Link href="/tenant/documents">
                  <b>Documents</b>
                  <span>
                    View shared files
                  </span>
                </Link>
              </div>
            </section>

            <section
              className={
                styles.contentGrid
              }
            >
              <article
                className={
                  styles.panel
                }
              >
                <div
                  className={
                    styles.panelHead
                  }
                >
                  <div>
                    <span
                      className={
                        styles.eyebrow
                      }
                    >
                      RECENT PAYMENTS
                    </span>

                    <h2>
                      Payment history
                    </h2>
                  </div>
                </div>

                {data.payments.length ===
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
                    {data.payments
                      .slice(0, 4)
                      .map(
                        (payment) => {
                          const receipt =
                            data.receipts.find(
                              (item) =>
                                item.payment_id ===
                                payment.id,
                            );

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
                                  {money(
                                    payment.amount,
                                  )}
                                </strong>

                                <span>
                                  {new Date(
                                    payment.payment_date,
                                  ).toLocaleDateString(
                                    "en-NG",
                                  )}
                                </span>
                              </div>

                              <div>
                                <span>
                                  {humanize(
                                    payment.payment_method,
                                  )}
                                </span>

                                {receipt ? (
                                  <small>
                                    {
                                      receipt.receipt_number
                                    }
                                  </small>
                                ) : null}
                              </div>
                            </div>
                          );
                        },
                      )}
                  </div>
                )}
              </article>

              <article
                className={
                  styles.panel
                }
              >
                <div
                  className={
                    styles.panelHead
                  }
                >
                  <div>
                    <span
                      className={
                        styles.eyebrow
                      }
                    >
                      MAINTENANCE
                    </span>

                    <h2>
                      My requests
                    </h2>
                  </div>
                </div>

                {openMaintenance.length ===
                0 ? (
                  <div
                    className={
                      styles.empty
                    }
                  >
                    You have no open
                    maintenance requests.
                  </div>
                ) : (
                  <div
                    className={
                      styles.list
                    }
                  >
                    {openMaintenance
                      .slice(0, 4)
                      .map(
                        (request) => (
                          <div
                            key={
                              request.id
                            }
                            className={
                              styles.row
                            }
                          >
                            <div>
                              <strong>
                                {
                                  request.title
                                }
                              </strong>

                              <span>
                                {humanize(
                                  request.priority,
                                )}
                              </span>
                            </div>

                            <span
                              className={
                                styles.status
                              }
                            >
                              {humanize(
                                request.status,
                              )}
                            </span>
                          </div>
                        ),
                      )}
                  </div>
                )}
              </article>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
