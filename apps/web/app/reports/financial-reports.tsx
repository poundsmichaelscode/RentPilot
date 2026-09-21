"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  apiDownload,
  apiFetch,
} from "../../lib/api";

import styles from "../management.module.css";

type Property = {
  id: string;
  name: string;
};

type PropertyReport = {
  propertyId: string;
  propertyName: string;
  rentCollected:
    | number
    | string;
  paidExpenses:
    | number
    | string;
  pendingExpenses:
    | number
    | string;
  netCashFlow:
    | number
    | string;
};

type ForeignCurrencyExpense = {
  currency: string;
  paidExpenses:
    | number
    | string;
  pendingExpenses:
    | number
    | string;
};

type FinancialReport = {
  organisationId: string;
  propertyId:
    | string
    | null;

  from: string;
  to: string;

  currency: string;

  summary: {
    rentCollected:
      | number
      | string;

    paidExpenses:
      | number
      | string;

    pendingExpenses:
      | number
      | string;

    netCashFlow:
      | number
      | string;

    organisationWidePaidExpenses:
      | number
      | string;

    organisationWidePendingExpenses:
      | number
      | string;
  };

  properties:
    PropertyReport[];

  foreignCurrencyExpenses:
    ForeignCurrencyExpense[];

  basis: {
    accountingBasis: string;
    rentIncomeUses: string;
    expensesUse: string;

    pendingExpensesIncludedInNetCashFlow:
      boolean;

    cancelledExpensesExcluded:
      boolean;

    foreignCurrenciesExcludedFromNetCashFlow:
      boolean;

    organisationWideExpensesAllocatedToProperties:
      boolean;
  };
};

type ReportResponse = {
  success: true;
  data: FinancialReport;
};

type ListResponse<T> = {
  success: true;
  data: T[];
};

function todayUtc() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function yearStartUtc() {
  const year =
    new Date()
      .getUTCFullYear();

  return `${year}-01-01`;
}

function money(
  value: number | string,
  currency: string,
) {
  const amount =
    Number(value || 0);

  try {
    return new Intl.NumberFormat(
      "en-NG",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      },
    ).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
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

export default function FinancialReports() {
  const [
    properties,
    setProperties,
  ] = useState<Property[]>([]);

  const [
    report,
    setReport,
  ] =
    useState<FinancialReport | null>(
      null,
    );

  const [
    from,
    setFrom,
  ] = useState(
    yearStartUtc(),
  );

  const [
    to,
    setTo,
  ] = useState(
    todayUtc(),
  );

  const [
    propertyId,
    setPropertyId,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    exporting,
    setExporting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const loadReport =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError(null);

          const params =
            new URLSearchParams();

          params.set(
            "from",
            from,
          );

          params.set(
            "to",
            to,
          );

          if (propertyId) {
            params.set(
              "propertyId",
              propertyId,
            );
          }

          const [
            reportResponse,
            propertyResponse,
          ] = await Promise.all([
            apiFetch<
              ReportResponse
            >(
              `/reports/financial?${params.toString()}`,
            ),

            apiFetch<
              ListResponse<Property>
            >(
              "/properties",
            ),
          ]);

          setReport(
            reportResponse.data,
          );

          setProperties(
            propertyResponse.data,
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load financial report.",
          );
        } finally {
          setLoading(false);
        }
      },
      [
        from,
        to,
        propertyId,
      ],
    );

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const selectedProperty =
    useMemo(
      () =>
        properties.find(
          (property) =>
            property.id ===
            propertyId,
        ),
      [
        properties,
        propertyId,
      ],
    );

  const currency =
    report?.currency ??
    "NGN";

  const summary =
    report?.summary;

  const hasForeignCurrency =
    Boolean(
      report
        ?.foreignCurrencyExpenses
        .length,
    );

  function resetFilters() {
    setFrom(
      yearStartUtc(),
    );

    setTo(
      todayUtc(),
    );

    setPropertyId("");
  }

  async function downloadCsv() {
    setExporting(true);
    setError(null);

    try {
      const params =
        new URLSearchParams();

      params.set(
        "from",
        from,
      );

      params.set(
        "to",
        to,
      );

      if (propertyId) {
        params.set(
          "propertyId",
          propertyId,
        );
      }

      await apiDownload(
        `/reports/financial.csv?${params.toString()}`,

        `rentpilot-financial-report-${from}-to-${to}.csv`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to export financial report.",
      );
    } finally {
      setExporting(false);
    }
  }

  function printReport() {
    window.print();
  }

  return (
    <main
      className={styles.page}
    >
      <div
        className={styles.shell}
      >
        <div
          className={`${styles.topbar} ${styles.noPrint}`}
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

            <Link href="/expenses">
              Expenses
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
              FINANCIAL PERFORMANCE
            </span>

            <h1>
              Financial reports
            </h1>

            <p>
              Review rent
              collections, operating
              expenses and net cash
              flow across your rental
              portfolio.
            </p>
          </div>

          <div
            className={styles.noPrint}
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className={styles.secondary}
              disabled={
                exporting ||
                loading ||
                !report
              }
              onClick={() =>
                void downloadCsv()
              }
            >
              {exporting
                ? "Exporting..."
                : "Download CSV"}
            </button>

            <button
              type="button"
              className={styles.primary}
              disabled={
                loading ||
                !report
              }
              onClick={printReport}
            >
              Print / Save PDF
            </button>
          </div>
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

        <section
          className={`${styles.card} ${styles.noPrint}`}
          style={{
            marginBottom: 24,
          }}
        >
          <div
            className={
              styles.sectionTitle
            }
          >
            <h2>
              Report period
            </h2>

            <p>
              Filter by date range
              and optionally by
              property.
            </p>
          </div>

          <div
            className={styles.grid}
          >
            <label>
              From

              <input
                type="date"
                value={from}
                max={to}
                onChange={(
                  event,
                ) =>
                  setFrom(
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
                value={to}
                min={from}
                onChange={(
                  event,
                ) =>
                  setTo(
                    event.target
                      .value,
                  )
                }
              />
            </label>

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
                  resetFilters
                }
              >
                Reset report
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <section
            className={styles.card}
          >
            <div
              className={
                styles.empty
              }
            >
              Loading financial
              report…
            </div>
          </section>
        ) : report ? (
          <>
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
                  Net cash flow
                </small>

                <strong>
                  {money(
                    summary
                      ?.netCashFlow ??
                      0,
                    currency,
                  )}
                </strong>

                <p>
                  Rent collected
                  less paid expenses
                </p>
              </article>

              <article
                className={
                  styles.card
                }
              >
                <small>
                  Rent collected
                </small>

                <h2>
                  {money(
                    summary
                      ?.rentCollected ??
                      0,
                    currency,
                  )}
                </h2>

                <p>
                  Recorded rent
                  payments
                </p>
              </article>

              <article
                className={
                  styles.card
                }
              >
                <small>
                  Paid expenses
                </small>

                <h2>
                  {money(
                    summary
                      ?.paidExpenses ??
                      0,
                    currency,
                  )}
                </h2>

                <p>
                  Operating costs
                  already settled
                </p>
              </article>

              <article
                className={
                  styles.card
                }
              >
                <small>
                  Pending expenses
                </small>

                <h2>
                  {money(
                    summary
                      ?.pendingExpenses ??
                      0,
                    currency,
                  )}
                </h2>

                <p>
                  Not included in
                  net cash flow
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
                <h2>
                  Report summary
                </h2>

                <p>
                  {selectedProperty
                    ? selectedProperty
                        .name
                    : "Entire organisation"}
                  {" · "}
                  {report.from}
                  {" → "}
                  {report.to}
                </p>
              </div>

              <div
                className={
                  styles.grid
                }
              >
                <article>
                  <small>
                    Organisation-wide
                    paid expenses
                  </small>

                  <h3>
                    {money(
                      summary
                        ?.organisationWidePaidExpenses ??
                        0,
                      currency,
                    )}
                  </h3>
                </article>

                <article>
                  <small>
                    Organisation-wide
                    pending expenses
                  </small>

                  <h3>
                    {money(
                      summary
                        ?.organisationWidePendingExpenses ??
                        0,
                      currency,
                    )}
                  </h3>
                </article>
              </div>
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
                <h2>
                  Property
                  performance
                </h2>

                <p>
                  Cash-basis
                  performance for
                  property-linked
                  transactions.
                </p>
              </div>

              {report.properties
                .length === 0 ? (
                <div
                  className={
                    styles.empty
                  }
                >
                  No properties are
                  available for this
                  report.
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
                          Property
                        </th>

                        <th>
                          Rent collected
                        </th>

                        <th>
                          Paid expenses
                        </th>

                        <th>
                          Pending
                        </th>

                        <th>
                          Net cash flow
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {report.properties.map(
                        (
                          property,
                        ) => (
                          <tr
                            key={
                              property.propertyId
                            }
                          >
                            <td>
                              <strong>
                                {
                                  property.propertyName
                                }
                              </strong>
                            </td>

                            <td>
                              {money(
                                property.rentCollected,
                                currency,
                              )}
                            </td>

                            <td>
                              {money(
                                property.paidExpenses,
                                currency,
                              )}
                            </td>

                            <td>
                              {money(
                                property.pendingExpenses,
                                currency,
                              )}
                            </td>

                            <td>
                              <strong>
                                {money(
                                  property.netCashFlow,
                                  currency,
                                )}
                              </strong>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {hasForeignCurrency ? (
              <section
                className={
                  styles.card
                }
                style={{
                  marginBottom: 24,
                }}
              >
                <div
                  className={
                    styles.sectionTitle
                  }
                >
                  <h2>
                    Other currencies
                  </h2>

                  <p>
                    These expenses
                    are disclosed
                    separately and
                    are not mixed
                    into the{" "}
                    {currency} net
                    cash-flow total.
                  </p>
                </div>

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
                          Currency
                        </th>

                        <th>
                          Paid expenses
                        </th>

                        <th>
                          Pending
                          expenses
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {report
                        .foreignCurrencyExpenses
                        .map(
                          (
                            item,
                          ) => (
                            <tr
                              key={
                                item.currency
                              }
                            >
                              <td>
                                <strong>
                                  {
                                    item.currency
                                  }
                                </strong>
                              </td>

                              <td>
                                {money(
                                  item.paidExpenses,
                                  item.currency,
                                )}
                              </td>

                              <td>
                                {money(
                                  item.pendingExpenses,
                                  item.currency,
                                )}
                              </td>
                            </tr>
                          ),
                        )}
                    </tbody>
                  </table>
                </div>
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
                  Accounting basis
                </h2>

                <p>
                  How RENTpilot
                  calculates this
                  report.
                </p>
              </div>

              <div
                className={
                  styles.grid
                }
              >
                <article>
                  <small>
                    Accounting basis
                  </small>

                  <h3>
                    {humanize(
                      report.basis
                        .accountingBasis,
                    )}
                  </h3>

                  <p>
                    Income uses
                    actual recorded
                    rent payments.
                  </p>
                </article>

                <article>
                  <small>
                    Expenses
                  </small>

                  <h3>
                    Paid expenses
                  </h3>

                  <p>
                    Pending expenses
                    are disclosed but
                    excluded from net
                    cash flow.
                  </p>
                </article>

                <article>
                  <small>
                    Cancelled
                  </small>

                  <h3>
                    Excluded
                  </h3>

                  <p>
                    Cancelled
                    expenses do not
                    affect financial
                    totals.
                  </p>
                </article>

                <article>
                  <small>
                    Currency
                  </small>

                  <h3>
                    {currency}
                  </h3>

                  <p>
                    Other currencies
                    remain separate
                    until conversion
                    support is added.
                  </p>
                </article>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
