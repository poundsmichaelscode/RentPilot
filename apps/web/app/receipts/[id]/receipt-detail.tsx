"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { apiFetch } from "../../../lib/api";
import styles from "../../management.module.css";

type ReceiptResponse = {
  success: true;

  data: {
    id: string;
    receipt_number: string;
    status: string;
    issued_at: string;

    payment: {
      id: string;
      amount: number | string;
      payment_date: string;
      payment_method: string;
      reference: string | null;
      notes: string | null;
    } | null;
  };
};

function money(value: number | string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export default function ReceiptDetail({
  receiptId,
}: {
  receiptId: string;
}) {
  const [receipt, setReceipt] =
    useState<
      ReceiptResponse["data"] | null
    >(null);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response =
          await apiFetch<ReceiptResponse>(
            `/receipts/${receiptId}`,
          );

        setReceipt(response.data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load receipt.",
        );
      }
    }

    void load();
  }, [receiptId]);

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

  if (!receipt) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          Loading receipt…
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div
        className={styles.shell}
        style={{ maxWidth: 760 }}
      >
        <div className={styles.topbar}>
          <Link
            className={styles.back}
            href="/payments"
          >
            ← Payments
          </Link>

          <button
            className={styles.secondary}
            type="button"
            onClick={() =>
              window.print()
            }
          >
            Print receipt
          </button>
        </div>

        <section className={styles.card}>
          <span className={styles.eyebrow}>
            RENTPILOT RECEIPT
          </span>

          <h1>{receipt.receipt_number}</h1>

          <p>
            Status: <strong>{receipt.status}</strong>
          </p>

          <hr />

          {receipt.payment ? (
            <>
              <p>Amount received</p>

              <h2>
                {money(
                  receipt.payment.amount,
                )}
              </h2>

              <div className={styles.grid}>
                <div>
                  <small>Payment date</small>
                  <p>
                    {receipt.payment.payment_date}
                  </p>
                </div>

                <div>
                  <small>Payment method</small>
                  <p>
                    {receipt.payment.payment_method.replaceAll(
                      "_",
                      " ",
                    )}
                  </p>
                </div>

                <div>
                  <small>Reference</small>
                  <p>
                    {receipt.payment.reference ??
                      "—"}
                  </p>
                </div>

                <div>
                  <small>Issued</small>
                  <p>
                    {new Date(
                      receipt.issued_at,
                    ).toLocaleString("en-NG")}
                  </p>
                </div>
              </div>

              {receipt.payment.notes ? (
                <>
                  <small>Notes</small>
                  <p>
                    {receipt.payment.notes}
                  </p>
                </>
              ) : null}
            </>
          ) : (
            <p>
              Payment information is unavailable.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
