"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import { apiFetch } from "../../lib/api";
import styles from "../management.module.css";

type Payment = {
  id: string;
  amount: number | string;
  payment_date: string;
  payment_method: string;
  reference: string | null;
};

type Receipt = {
  id: string;
  payment_id: string;
  receipt_number: string;
  status: string;
};

type ListResponse<T> = {
  success: true;
  data: T[];
};

function money(value: number | string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export default function PaymentList() {
  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [receipts, setReceipts] =
    useState<Receipt[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [
          paymentResponse,
          receiptResponse,
        ] = await Promise.all([
          apiFetch<ListResponse<Payment>>(
            "/rent-payments",
          ),

          apiFetch<ListResponse<Receipt>>(
            "/receipts",
          ),
        ]);

        setPayments(paymentResponse.data);
        setReceipts(receiptResponse.data);
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

  const receiptByPayment =
    useMemo(
      () =>
        new Map(
          receipts.map((receipt) => [
            receipt.payment_id,
            receipt,
          ]),
        ),
      [receipts],
    );

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <Link
            className={styles.back}
            href="/rent"
          >
            ← Rent
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
              COLLECTION HISTORY
            </span>

            <h1>Payments</h1>

            <p>
              Recorded rent collections and
              their issued receipts.
            </p>
          </div>

          <Link
            className={styles.primary}
            href="/payments/new"
          >
            + Record payment
          </Link>
        </header>

        {error ? (
          <div className={styles.error}>
            {error}
          </div>
        ) : loading ? (
          <div className={styles.empty}>
            Loading payments…
          </div>
        ) : payments.length === 0 ? (
          <div className={styles.empty}>
            No rent payments recorded yet.
          </div>
        ) : (
          <div className={styles.list}>
            {payments.map((payment) => {
              const receipt =
                receiptByPayment.get(
                  payment.id,
                );

              return (
                <article
                  key={payment.id}
                  className={styles.row}
                >
                  <div>
                    <strong>
                      {money(payment.amount)}
                    </strong>

                    <small>
                      {payment.payment_date}
                    </small>
                  </div>

                  <span>
                    {payment.payment_method.replaceAll(
                      "_",
                      " ",
                    )}
                  </span>

                  <span>
                    {payment.reference ??
                      "No reference"}
                  </span>

                  {receipt ? (
                    <Link
                      href={`/receipts/${receipt.id}`}
                    >
                      {receipt.receipt_number} →
                    </Link>
                  ) : (
                    <span>No receipt</span>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
