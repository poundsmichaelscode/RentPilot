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

type Charge = {
  id: string;
  due_date: string;
  expected_amount: number | string;
  paid_amount: number | string;
  balance: number | string;
  status: string;
};

type Payment = {
  id: string;
  amount: number | string;
  payment_date: string;
  payment_method: string;
};

type Receipt = {
  id: string;
  payment_id: string;
  receipt_number: string;
  issued_at?: string | null;
};

type PortalResponse = {
  success: true;

  data: {
    charges: Charge[];
    payments: Payment[];
    receipts: Receipt[];
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

export default function TenantPayments() {
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
            : "Unable to load payments.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const totals =
    useMemo(() => {
      const charges =
        data?.charges ?? [];

      const payments =
        data?.payments ?? [];

      const outstanding =
        charges.reduce(
          (sum, charge) =>
            sum +
            Math.max(
              0,
              Number(
                charge.balance || 0,
              ),
            ),
          0,
        );

      const overdue =
        charges
          .filter(
            (charge) =>
              charge.status ===
              "OVERDUE",
          )
          .reduce(
            (sum, charge) =>
              sum +
              Math.max(
                0,
                Number(
                  charge.balance ||
                    0,
                ),
              ),
            0,
          );

      const paid =
        payments.reduce(
          (sum, payment) =>
            sum +
            Number(
              payment.amount || 0,
            ),
          0,
        );

      return {
        outstanding,
        overdue,
        paid,
      };
    }, [data]);

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.loading}>
            Loading your rent account…
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

  const payments =
    data?.payments ?? [];

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
            <Link href="/tenant/lease">
              My lease
            </Link>

            <Link href="/tenant/documents">
              Documents
            </Link>
          </div>
        </nav>

        <header className={styles.hero}>
          <span className={styles.eyebrow}>
            MY RENT
          </span>

          <h1>
            Payments and rent history.
          </h1>

          <p>
            Track what has been paid,
            what remains outstanding and
            your recorded receipts.
          </p>
        </header>

        <section className={styles.metrics}>
          <article
            className={
              styles.moneyMetric
            }
          >
            <span>
              TOTAL PAID
            </span>

            <strong>
              {money(totals.paid)}
            </strong>

            <p>
              Recorded payments
            </p>
          </article>

          <article className={styles.metric}>
            <span>
              OUTSTANDING
            </span>

            <strong>
              {money(
                totals.outstanding,
              )}
            </strong>

            <p>
              Current unpaid balance
            </p>
          </article>

          <article className={styles.metric}>
            <span>
              OVERDUE
            </span>

            <strong>
              {money(
                totals.overdue,
              )}
            </strong>

            <p>
              Past-due rent balance
            </p>
          </article>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>
              PAYMENT HISTORY
            </span>

            <h2>
              Recorded payments
            </h2>

            <p>
              Payments recorded against
              your linked lease.
            </p>
          </div>

          {payments.length === 0 ? (
            <div className={styles.empty}>
              No payments have been
              recorded yet.
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>AMOUNT</th>
                    <th>METHOD</th>
                    <th>RECEIPT</th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map(
                    (payment) => {
                      const receipt =
                        data?.receipts.find(
                          (item) =>
                            item.payment_id ===
                            payment.id,
                        );

                      return (
                        <tr key={payment.id}>
                          <td>
                            {new Date(
                              payment.payment_date,
                            ).toLocaleDateString(
                              "en-NG",
                            )}
                          </td>

                          <td>
                            <strong>
                              {money(
                                payment.amount,
                              )}
                            </strong>
                          </td>

                          <td>
                            {humanize(
                              payment.payment_method,
                            )}
                          </td>

                          <td>
                            {receipt
                              ? receipt.receipt_number
                              : "—"}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
