"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  apiFetch,
} from "../../lib/api";

import styles from "../management.module.css";

type Expense = {
  id: string;
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
  created_at: string;
};

type Property = {
  id: string;
  name: string;
};

type ExpenseResponse = {
  success: true;
  data: Expense[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type ListResponse<T> = {
  success: true;
  data: T[];
};

const categories = [
  "MAINTENANCE",
  "REPAIRS",
  "UTILITIES",
  "INSURANCE",
  "PROPERTY_TAX",
  "SECURITY",
  "CLEANING",
  "MANAGEMENT_FEE",
  "LEGAL_PROFESSIONAL",
  "RENOVATION",
  "OTHER",
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
        maximumFractionDigits: 0,
      },
    ).format(Number(value));
  } catch {
    return `${currency} ${Number(
      value,
    ).toLocaleString()}`;
  }
}

export default function ExpensesDashboard() {
  const [
    expenses,
    setExpenses,
  ] = useState<Expense[]>([]);

  const [
    properties,
    setProperties,
  ] = useState<Property[]>([]);

  const [
    totalRecords,
    setTotalRecords,
  ] = useState(0);

  const [
    category,
    setCategory,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState("");

  const [
    propertyId,
    setPropertyId,
  ] = useState("");

  const [
    fromDate,
    setFromDate,
  ] = useState("");

  const [
    toDate,
    setToDate,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const load = useCallback(
    async () => {
      try {
        setError(null);
        setLoading(true);

        const params =
          new URLSearchParams();

        params.set(
          "pageSize",
          "100",
        );

        if (category) {
          params.set(
            "category",
            category,
          );
        }

        if (status) {
          params.set(
            "status",
            status,
          );
        }

        if (propertyId) {
          params.set(
            "propertyId",
            propertyId,
          );
        }

        if (fromDate) {
          params.set(
            "from",
            fromDate,
          );
        }

        if (toDate) {
          params.set(
            "to",
            toDate,
          );
        }

        const [
          expenseResponse,
          propertyResponse,
        ] = await Promise.all([
          apiFetch<ExpenseResponse>(
            `/expenses?${params.toString()}`,
          ),

          apiFetch<
            ListResponse<Property>
          >("/properties"),
        ]);

        setExpenses(
          expenseResponse.data,
        );

        setTotalRecords(
          expenseResponse
            .pagination.total,
        );

        setProperties(
          propertyResponse.data,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load expenses.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      category,
      status,
      propertyId,
      fromDate,
      toDate,
    ],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const propertyById =
    useMemo(
      () =>
        new Map(
          properties.map(
            (property) => [
              property.id,
              property.name,
            ],
          ),
        ),
      [properties],
    );

  const paidExpenses =
    expenses.filter(
      (expense) =>
        expense.status ===
        "PAID",
    );

  const pendingExpenses =
    expenses.filter(
      (expense) =>
        expense.status ===
        "PENDING",
    );

  const shownValue =
    expenses
      .filter(
        (expense) =>
          expense.status !==
          "CANCELLED",
      )
      .reduce(
        (total, expense) =>
          total +
          Number(expense.amount),
        0,
      );

  const paidValue =
    paidExpenses.reduce(
      (total, expense) =>
        total +
        Number(expense.amount),
      0,
    );

  function clearFilters() {
    setCategory("");
    setStatus("");
    setPropertyId("");
    setFromDate("");
    setToDate("");
  }

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
            href="/dashboard"
          >
            ← Dashboard
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

            <Link href="/maintenance">
              Maintenance
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
              OPERATING COSTS
            </span>

            <h1>Expenses</h1>

            <p>
              Track property,
              maintenance and
              organisation operating
              costs.
            </p>
          </div>

          <Link
            className={
              styles.primary
            }
            href="/expenses/new"
          >
            + Record expense
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
              Value shown
            </small>

            <strong>
              {money(
                shownValue,
                expenses[0]
                  ?.currency ??
                  "NGN",
              )}
            </strong>

            <p>
              Up to 100 filtered
              records
            </p>
          </article>

          <article
            className={styles.card}
          >
            <small>
              Expense records
            </small>

            <h2>
              {totalRecords}
            </h2>

            <p>
              Matching current
              filters
            </p>
          </article>

          <article
            className={styles.card}
          >
            <small>
              Paid shown
            </small>

            <h2>
              {money(
                paidValue,
                paidExpenses[0]
                  ?.currency ??
                  "NGN",
              )}
            </h2>

            <p>
              {paidExpenses.length}{" "}
              paid records
            </p>
          </article>

          <article
            className={styles.card}
          >
            <small>
              Pending shown
            </small>

            <h2>
              {
                pendingExpenses.length
              }
            </h2>

            <p>
              Awaiting settlement
            </p>
          </article>
        </section>

        <section
          className={styles.card}
          style={{
            marginBottom: 24,
          }}
        >
          <div
            className={
              styles.sectionTitle
            }
          >
            <h2>Filters</h2>

            <p>
              Narrow expenses by
              property, category,
              status or date.
            </p>
          </div>

          <div
            className={styles.grid}
          >
            <label>
              Property

              <select
                value={propertyId}
                onChange={(
                  event,
                ) =>
                  setPropertyId(
                    event.target
                      .value,
                  )
                }
              >
                <option value="">
                  All properties
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
              Category

              <select
                value={category}
                onChange={(
                  event,
                ) =>
                  setCategory(
                    event.target
                      .value,
                  )
                }
              >
                <option value="">
                  All categories
                </option>

                {categories.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {humanize(
                        item,
                      )}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              Status

              <select
                value={status}
                onChange={(
                  event,
                ) =>
                  setStatus(
                    event.target
                      .value,
                  )
                }
              >
                <option value="">
                  All statuses
                </option>

                <option value="PENDING">
                  Pending
                </option>

                <option value="PAID">
                  Paid
                </option>

                <option value="CANCELLED">
                  Cancelled
                </option>
              </select>
            </label>

            <label>
              From

              <input
                type="date"
                value={fromDate}
                onChange={(
                  event,
                ) =>
                  setFromDate(
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <label>
              To

              <input
                type="date"
                value={toDate}
                onChange={(
                  event,
                ) =>
                  setToDate(
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <div
              style={{
                display: "flex",
                alignItems:
                  "flex-end",
              }}
            >
              <button
                type="button"
                className={
                  styles.secondary
                }
                onClick={
                  clearFilters
                }
              >
                Clear filters
              </button>
            </div>
          </div>
        </section>

        <section
          className={styles.card}
        >
          <div
            className={
              styles.sectionTitle
            }
          >
            <h2>
              Expense history
            </h2>

            <p>
              Organisation-scoped
              operating costs.
            </p>
          </div>

          {loading ? (
            <div
              className={
                styles.empty
              }
            >
              Loading expenses…
            </div>
          ) : expenses.length ===
            0 ? (
            <div
              className={
                styles.empty
              }
            >
              No expenses match
              your current filters.
            </div>
          ) : (
            <div
              className={
                styles.tableWrap
              }
            >
              <table
                className={
                  styles.table
                }
              >
                <thead>
                  <tr>
                    <th>
                      Description
                    </th>

                    <th>
                      Property
                    </th>

                    <th>
                      Category
                    </th>

                    <th>
                      Date
                    </th>

                    <th>
                      Amount
                    </th>

                    <th>
                      Status
                    </th>

                    <th />
                  </tr>
                </thead>

                <tbody>
                  {expenses.map(
                    (expense) => (
                      <tr
                        key={
                          expense.id
                        }
                      >
                        <td>
                          <strong>
                            {
                              expense.description
                            }
                          </strong>

                          {expense.vendor_name ? (
                            <div>
                              {
                                expense.vendor_name
                              }
                            </div>
                          ) : null}
                        </td>

                        <td>
                          {expense.property_id
                            ? propertyById.get(
                                expense.property_id,
                              ) ??
                              "Property"
                            : "Organisation-wide"}
                        </td>

                        <td>
                          {humanize(
                            expense.category,
                          )}
                        </td>

                        <td>
                          {
                            expense.expense_date
                          }
                        </td>

                        <td>
                          {money(
                            expense.amount,
                            expense.currency,
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              styles.status
                            }
                          >
                            {humanize(
                              expense.status,
                            )}
                          </span>
                        </td>

                        <td>
                          <Link
                            href={`/expenses/${expense.id}`}
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ),
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
