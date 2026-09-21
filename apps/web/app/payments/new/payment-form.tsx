"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { apiFetch } from "../../../lib/api";
import styles from "../../management.module.css";

type Charge = {
  id: string;
  lease_id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  expected_amount: number | string;
  balance: number;
  status: string;
};

type ChargesResponse = {
  success: true;
  data: Charge[];
};

type PaymentResponse = {
  success: true;

  data: {
    paymentId: string;
    receiptId: string;
    receiptNumber: string;
    created: boolean;
  };
};

const PAYMENT_METHODS = [
  ["BANK_TRANSFER", "Bank transfer"],
  ["CASH", "Cash"],
  ["CARD", "Card"],
  ["POS", "POS"],
  ["CHEQUE", "Cheque"],
  ["OTHER", "Other"],
] as const;

export default function PaymentForm({
  initialChargeId,
}: {
  initialChargeId: string;
}) {
  const router = useRouter();

  const idempotencyKey =
    useRef<string>("");

  const [charges, setCharges] =
    useState<Charge[]>([]);

  const [chargeId, setChargeId] =
    useState(initialChargeId);

  const [amount, setAmount] =
    useState("");

  const [paymentDate, setPaymentDate] =
    useState(
      new Date().toISOString().slice(0, 10),
    );

  const [paymentMethod, setPaymentMethod] =
    useState("BANK_TRANSFER");

  const [reference, setReference] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [loadingOptions, setLoadingOptions] =
    useState(true);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response =
          await apiFetch<ChargesResponse>(
            "/rent-charges",
          );

        setCharges(
          response.data.filter(
            (charge) =>
              charge.balance > 0 &&
              !["PAID", "WAIVED"].includes(
                charge.status,
              ),
          ),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load rent charges.",
        );
      } finally {
        setLoadingOptions(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    const selected = charges.find(
      (charge) => charge.id === chargeId,
    );

    if (selected) {
      setAmount(String(selected.balance));
    }
  }, [chargeId, charges]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const selected = charges.find(
      (charge) => charge.id === chargeId,
    );

    if (!selected) {
      setError("Choose a valid rent charge.");
      return;
    }

    if (!idempotencyKey.current) {
      idempotencyKey.current =
        crypto.randomUUID();
    }

    setLoading(true);
    setError(null);

    try {
      const response =
        await apiFetch<PaymentResponse>(
          "/rent-payments",
          {
            method: "POST",

            body: JSON.stringify({
              leaseId:
                selected.lease_id,

              rentChargeId:
                selected.id,

              amount:
                Number(amount),

              paymentDate,

              paymentMethod,

              reference:
                reference || undefined,

              notes:
                notes || undefined,

              idempotencyKey:
                idempotencyKey.current,
            }),
          },
        );

      router.replace(
        `/receipts/${response.data.receiptId}`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to record payment.",
      );
    } finally {
      setLoading(false);
    }
  }

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
            <Link href="/payments">
              Payment history
            </Link>
          </nav>
        </div>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>
              COLLECTION
            </span>

            <h1>Record rent payment.</h1>

            <p>
              Record money already received.
              RentPilot does not process the
              payment itself.
            </p>
          </div>
        </header>

        <section className={styles.card}>
          {loadingOptions ? (
            <div className={styles.empty}>
              Loading outstanding rent…
            </div>
          ) : (
            <form
              className={styles.form}
              onSubmit={handleSubmit}
            >
              <div className={styles.grid}>
                <label className={styles.full}>
                  Rent charge

                  <select
                    required
                    value={chargeId}
                    onChange={(event) =>
                      setChargeId(
                        event.target.value,
                      )
                    }
                  >
                    <option value="">
                      Choose outstanding charge
                    </option>

                    {charges.map((charge) => (
                      <option
                        key={charge.id}
                        value={charge.id}
                      >
                        {charge.period_start}
                        {" → "}
                        {charge.period_end}
                        {" · balance ₦"}
                        {Number(
                          charge.balance,
                        ).toLocaleString("en-NG")}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Amount received

                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) =>
                      setAmount(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  Payment date

                  <input
                    required
                    type="date"
                    value={paymentDate}
                    onChange={(event) =>
                      setPaymentDate(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  Payment method

                  <select
                    value={paymentMethod}
                    onChange={(event) =>
                      setPaymentMethod(
                        event.target.value,
                      )
                    }
                  >
                    {PAYMENT_METHODS.map(
                      ([value, label]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  Reference

                  <input
                    maxLength={200}
                    placeholder="Bank reference or note"
                    value={reference}
                    onChange={(event) =>
                      setReference(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className={styles.full}>
                  Notes

                  <textarea
                    rows={4}
                    maxLength={3000}
                    value={notes}
                    onChange={(event) =>
                      setNotes(
                        event.target.value,
                      )
                    }
                  />
                </label>
              </div>

              {error ? (
                <div
                  role="alert"
                  className={styles.error}
                >
                  {error}
                </div>
              ) : null}

              <div className={styles.actions}>
                <Link
                  className={styles.secondary}
                  href="/rent"
                >
                  Cancel
                </Link>

                <button
                  className={styles.primary}
                  type="submit"
                  disabled={loading}
                >
                  {loading
                    ? "Recording payment..."
                    : "Record payment & issue receipt"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
