"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import {
  apiFetch,
} from "../../../lib/api";

import styles from "../../management.module.css";

type Expense = {
  id: string;
  organisation_id: string;
  property_id: string | null;
  unit_id: string | null;
  category: string;
  description: string;
  amount: number | string;
  currency: string;
  expense_date: string;
  vendor_name: string | null;
  reference: string | null;
  payment_method: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
};

type Property = {
  id: string;
  name: string;
};

type Unit = {
  id: string;
  property_id: string;
  unit_number: string;
};

type DetailResponse = {
  success: true;
  data: Expense;
};

type ListResponse<T> = {
  success: true;
  data: T[];
};

const categories = [
  ["MAINTENANCE", "Maintenance"],
  ["REPAIRS", "Repairs"],
  ["UTILITIES", "Utilities"],
  ["INSURANCE", "Insurance"],
  [
    "PROPERTY_TAX",
    "Property tax",
  ],
  ["SECURITY", "Security"],
  ["CLEANING", "Cleaning"],
  [
    "MANAGEMENT_FEE",
    "Management fee",
  ],
  [
    "LEGAL_PROFESSIONAL",
    "Legal / professional",
  ],
  ["RENOVATION", "Renovation"],
  ["OTHER", "Other"],
] as const;

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

function money(
  value: number | string,
  currency: string,
) {
  try {
    return new Intl.NumberFormat(
      "en-NG",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      },
    ).format(
      Number(value),
    );
  } catch {
    return `${currency} ${Number(
      value,
    ).toLocaleString()}`;
  }
}

export default function ExpenseDetail({
  expenseId,
}: {
  expenseId: string;
}) {
  const router =
    useRouter();

  const [
    expense,
    setExpense,
  ] = useState<Expense | null>(
    null,
  );

  const [
    properties,
    setProperties,
  ] = useState<Property[]>([]);

  const [
    units,
    setUnits,
  ] = useState<Unit[]>([]);

  const [
    propertyId,
    setPropertyId,
  ] = useState("");

  const [
    unitId,
    setUnitId,
  ] = useState("");

  const [
    category,
    setCategory,
  ] = useState("OTHER");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    amount,
    setAmount,
  ] = useState("");

  const [
    currency,
    setCurrency,
  ] = useState("NGN");

  const [
    expenseDate,
    setExpenseDate,
  ] = useState("");

  const [
    vendorName,
    setVendorName,
  ] = useState("");

  const [
    reference,
    setReference,
  ] = useState("");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState("");

  const [
    notes,
    setNotes,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    action,
    setAction,
  ] = useState<
    | "paid"
    | "cancel"
    | "delete"
    | null
  >(null);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    notice,
    setNotice,
  ] = useState<string | null>(
    null,
  );

  const applyExpense =
    useCallback(
      (
        nextExpense: Expense,
      ) => {
        setExpense(nextExpense);

        setPropertyId(
          nextExpense
            .property_id ??
            "",
        );

        setUnitId(
          nextExpense
            .unit_id ??
            "",
        );

        setCategory(
          nextExpense.category,
        );

        setDescription(
          nextExpense.description,
        );

        setAmount(
          String(
            nextExpense.amount,
          ),
        );

        setCurrency(
          nextExpense.currency,
        );

        setExpenseDate(
          nextExpense.expense_date,
        );

        setVendorName(
          nextExpense
            .vendor_name ??
            "",
        );

        setReference(
          nextExpense
            .reference ??
            "",
        );

        setPaymentMethod(
          nextExpense
            .payment_method ??
            "",
        );

        setNotes(
          nextExpense.notes ??
            "",
        );
      },
      [],
    );

  const load =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError(null);

          const [
            expenseResponse,
            propertyResponse,
            unitResponse,
          ] = await Promise.all([
            apiFetch<
              DetailResponse
            >(
              `/expenses/${expenseId}`,
            ),

            apiFetch<
              ListResponse<Property>
            >("/properties"),

            apiFetch<
              ListResponse<Unit>
            >("/units"),
          ]);

          applyExpense(
            expenseResponse.data,
          );

          setProperties(
            propertyResponse.data,
          );

          setUnits(
            unitResponse.data,
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load expense.",
          );
        } finally {
          setLoading(false);
        }
      },
      [
        expenseId,
        applyExpense,
      ],
    );

  useEffect(() => {
    void load();
  }, [load]);

  const propertyUnits =
    useMemo(
      () =>
        units.filter(
          (unit) =>
            unit.property_id ===
            propertyId,
        ),
      [
        units,
        propertyId,
      ],
    );

  const propertyName =
    useMemo(
      () =>
        properties.find(
          (property) =>
            property.id ===
            expense?.property_id,
        )?.name ??
        (expense?.property_id
          ? "Property"
          : "Organisation-wide"),
      [
        properties,
        expense?.property_id,
      ],
    );

  function changeProperty(
    nextPropertyId: string,
  ) {
    setPropertyId(
      nextPropertyId,
    );

    setUnitId("");
  }

  async function save(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !expense ||
      expense.status ===
        "CANCELLED"
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response =
        await apiFetch<
          DetailResponse
        >(
          `/expenses/${expenseId}`,
          {
            method: "PATCH",

            body: JSON.stringify({
              propertyId:
                propertyId ||
                null,

              unitId:
                unitId ||
                null,

              category,

              description,

              amount:
                Number(amount),

              currency,

              expenseDate,

              vendorName:
                vendorName ||
                null,

              reference:
                reference ||
                null,

              paymentMethod:
                paymentMethod ||
                null,

              notes:
                notes ||
                null,
            }),
          },
        );

      applyExpense(
        response.data,
      );

      setNotice(
        "Expense updated successfully.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update expense.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function markPaid() {
    if (!expense) {
      return;
    }

    setAction("paid");
    setError(null);
    setNotice(null);

    try {
      const response =
        await apiFetch<
          DetailResponse
        >(
          `/expenses/${expenseId}`,
          {
            method: "PATCH",

            body: JSON.stringify({
              status: "PAID",
            }),
          },
        );

      applyExpense(
        response.data,
      );

      setNotice(
        "Expense marked as paid.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to mark expense as paid.",
      );
    } finally {
      setAction(null);
    }
  }

  async function cancelExpense() {
    if (!expense) {
      return;
    }

    const confirmed =
      window.confirm(
        "Cancel this expense? A cancelled expense becomes immutable.",
      );

    if (!confirmed) {
      return;
    }

    setAction("cancel");
    setError(null);
    setNotice(null);

    try {
      const response =
        await apiFetch<
          DetailResponse
        >(
          `/expenses/${expenseId}`,
          {
            method: "PATCH",

            body: JSON.stringify({
              status:
                "CANCELLED",
            }),
          },
        );

      applyExpense(
        response.data,
      );

      setNotice(
        "Expense cancelled. The financial record is now immutable.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to cancel expense.",
      );
    } finally {
      setAction(null);
    }
  }

  async function deleteExpense() {
    const confirmed =
      window.confirm(
        "Permanently delete this expense? Only organisation owners and administrators can perform this action.",
      );

    if (!confirmed) {
      return;
    }

    setAction("delete");
    setError(null);
    setNotice(null);

    try {
      await apiFetch(
        `/expenses/${expenseId}`,
        {
          method: "DELETE",
        },
      );

      router.replace(
        "/expenses",
      );

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete expense.",
      );

      setAction(null);
    }
  }

  if (loading) {
    return (
      <main
        className={
          styles.page
        }
      >
        <div
          className={
            styles.shell
          }
        >
          <div
            className={
              styles.empty
            }
          >
            Loading expense…
          </div>
        </div>
      </main>
    );
  }

  if (!expense) {
    return (
      <main
        className={
          styles.page
        }
      >
        <div
          className={
            styles.shell
          }
        >
          <Link
            className={
              styles.back
            }
            href="/expenses"
          >
            ← Expenses
          </Link>

          <div
            className={
              styles.error
            }
            style={{
              marginTop: 24,
            }}
          >
            {error ??
              "Expense was not found."}
          </div>
        </div>
      </main>
    );
  }

  const cancelled =
    expense.status ===
    "CANCELLED";

  return (
    <main
      className={styles.page}
    >
      <div
        className={styles.shell}
      >
        <div
          className={styles.topbar}
        >
          <Link
            className={styles.back}
            href="/expenses"
          >
            ← Expenses
          </Link>

          <nav
            className={styles.nav}
          >
            <Link href="/rent">
              Rent
            </Link>

            <Link href="/payments">
              Payments
            </Link>

            <Link href="/audit-log">
              Audit log
            </Link>
          </nav>
        </div>

        <header
          className={styles.header}
        >
          <div>
            <span
              className={
                styles.eyebrow
              }
            >
              EXPENSE RECORD
            </span>

            <h1>
              {expense.description}
            </h1>

            <p>
              {propertyName}
              {" · "}
              {humanize(
                expense.category,
              )}
              {" · "}
              {
                expense.expense_date
              }
            </p>
          </div>

          <span
            className={
              styles.status
            }
          >
            {humanize(
              expense.status,
            )}
          </span>
        </header>

        {error ? (
          <div
            className={
              styles.error
            }
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {notice ? (
          <div
            className={
              styles.card
            }
            style={{
              marginBottom: 18,
              padding: 15,
            }}
          >
            {notice}
          </div>
        ) : null}

        <section
          className={
            styles.statGrid
          }
          style={{
            marginBottom: 24,
          }}
        >
          <article
            className={
              styles.moneyCard
            }
          >
            <small>
              Expense amount
            </small>

            <strong>
              {money(
                expense.amount,
                expense.currency,
              )}
            </strong>

            <p>
              {
                expense.currency
              }
            </p>
          </article>

          <article
            className={
              styles.card
            }
          >
            <small>
              Property
            </small>

            <h2>
              {propertyName}
            </h2>

            <p>
              {expense.unit_id
                ? "Unit-specific expense"
                : "Property / organisation expense"}
            </p>
          </article>

          <article
            className={
              styles.card
            }
          >
            <small>
              Vendor
            </small>

            <h2>
              {expense.vendor_name ??
                "—"}
            </h2>

            <p>
              {expense.reference ??
                "No reference"}
            </p>
          </article>
        </section>

        {cancelled ? (
          <section
            className={
              styles.card
            }
            style={{
              marginBottom: 24,
            }}
          >
            <span
              className={
                styles.eyebrow
              }
            >
              CANCELLED
            </span>

            <h2>
              Financial record
              locked
            </h2>

            <p>
              Cancelled expenses
              cannot be edited.
              This protects the
              expense history and
              audit trail.
            </p>
          </section>
        ) : null}

        <section
          className={styles.card}
        >
          <div
            className={
              styles.sectionTitle
            }
          >
            <h2>
              Expense details
            </h2>

            <p>
              Update the operating
              cost record.
            </p>
          </div>

          <form
            className={styles.form}
            onSubmit={save}
          >
            <div
              className={styles.grid}
            >
              <label>
                Property

                <select
                  value={propertyId}
                  disabled={cancelled}
                  onChange={(
                    event,
                  ) =>
                    changeProperty(
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="">
                    Organisation-wide
                  </option>

                  {properties.map(
                    (property) => (
                      <option
                        key={
                          property.id
                        }
                        value={
                          property.id
                        }
                      >
                        {
                          property.name
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Unit

                <select
                  value={unitId}
                  disabled={
                    cancelled ||
                    !propertyId
                  }
                  onChange={(
                    event,
                  ) =>
                    setUnitId(
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="">
                    Whole property /
                    no unit
                  </option>

                  {propertyUnits.map(
                    (unit) => (
                      <option
                        key={
                          unit.id
                        }
                        value={
                          unit.id
                        }
                      >
                        Unit{" "}
                        {
                          unit.unit_number
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Category

                <select
                  required
                  value={category}
                  disabled={cancelled}
                  onChange={(
                    event,
                  ) =>
                    setCategory(
                      event.target
                        .value,
                    )
                  }
                >
                  {categories.map(
                    ([
                      value,
                      label,
                    ]) => (
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
                Expense date

                <input
                  required
                  type="date"
                  value={
                    expenseDate
                  }
                  disabled={cancelled}
                  onChange={(
                    event,
                  ) =>
                    setExpenseDate(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label
                className={
                  styles.full
                }
              >
                Description

                <input
                  required
                  minLength={2}
                  maxLength={500}
                  value={
                    description
                  }
                  disabled={cancelled}
                  onChange={(
                    event,
                  ) =>
                    setDescription(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                Amount

                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  disabled={cancelled}
                  onChange={(
                    event,
                  ) =>
                    setAmount(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                Currency

                <input
                  required
                  minLength={3}
                  maxLength={3}
                  value={currency}
                  disabled={cancelled}
                  onChange={(
                    event,
                  ) =>
                    setCurrency(
                      event.target
                        .value
                        .toUpperCase(),
                    )
                  }
                />
              </label>

              <label>
                Vendor /
                supplier

                <input
                  maxLength={200}
                  value={vendorName}
                  disabled={cancelled}
                  onChange={(
                    event,
                  ) =>
                    setVendorName(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                Reference

                <input
                  maxLength={200}
                  value={reference}
                  disabled={cancelled}
                  onChange={(
                    event,
                  ) =>
                    setReference(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                Payment method

                <select
                  value={
                    paymentMethod
                  }
                  disabled={cancelled}
                  onChange={(
                    event,
                  ) =>
                    setPaymentMethod(
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="">
                    Not specified
                  </option>

                  <option value="BANK_TRANSFER">
                    Bank transfer
                  </option>

                  <option value="CASH">
                    Cash
                  </option>

                  <option value="CARD">
                    Card
                  </option>

                  <option value="POS">
                    POS
                  </option>

                  <option value="CHEQUE">
                    Cheque
                  </option>

                  <option value="OTHER">
                    Other
                  </option>
                </select>
              </label>

              <label
                className={
                  styles.full
                }
              >
                Notes

                <textarea
                  rows={5}
                  maxLength={2000}
                  value={notes}
                  disabled={cancelled}
                  onChange={(
                    event,
                  ) =>
                    setNotes(
                      event.target
                        .value,
                    )
                  }
                />
              </label>
            </div>

            {!cancelled ? (
              <div
                className={
                  styles.actions
                }
              >
                <Link
                  className={
                    styles.secondary
                  }
                  href="/expenses"
                >
                  Back
                </Link>

                <button
                  type="submit"
                  className={
                    styles.primary
                  }
                  disabled={
                    saving ||
                    !description ||
                    !amount
                  }
                >
                  {saving
                    ? "Saving..."
                    : "Save changes"}
                </button>
              </div>
            ) : null}
          </form>
        </section>

        <section
          className={styles.section}
        >
          <div
            className={
              styles.sectionTitle
            }
          >
            <h2>
              Expense actions
            </h2>

            <p>
              Financial state
              changes are preserved
              in the audit trail.
            </p>
          </div>

          <div
            className={
              styles.card
            }
          >
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              {expense.status ===
              "PENDING" ? (
                <button
                  type="button"
                  className={
                    styles.primary
                  }
                  disabled={
                    action !== null
                  }
                  onClick={() =>
                    void markPaid()
                  }
                >
                  {action ===
                  "paid"
                    ? "Updating..."
                    : "Mark paid"}
                </button>
              ) : null}

              {!cancelled ? (
                <button
                  type="button"
                  className={
                    styles.secondary
                  }
                  disabled={
                    action !== null
                  }
                  onClick={() =>
                    void cancelExpense()
                  }
                >
                  {action ===
                  "cancel"
                    ? "Cancelling..."
                    : "Cancel expense"}
                </button>
              ) : null}

              <button
                type="button"
                className={
                  styles.secondary
                }
                disabled={
                  action !== null
                }
                onClick={() =>
                  void deleteExpense()
                }
              >
                {action ===
                "delete"
                  ? "Deleting..."
                  : "Delete expense"}
              </button>
            </div>

            <p
              style={{
                marginTop: 14,
                marginBottom: 0,
              }}
            >
              Permanent deletion is
              restricted by the API
              to organisation owners
              and administrators.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
