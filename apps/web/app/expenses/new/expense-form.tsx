"use client";

import {
  type FormEvent,
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

type Property = {
  id: string;
  name: string;
};

type Unit = {
  id: string;
  property_id: string;
  unit_number: string;
};

type ListResponse<T> = {
  success: true;
  data: T[];
};

type CreateResponse = {
  success: true;
  data: {
    id: string;
  };
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

export default function ExpenseForm() {
  const router =
    useRouter();

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
  ] = useState(
    new Date()
      .toISOString()
      .slice(0, 10),
  );

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
  ] = useState(
    "BANK_TRANSFER",
  );

  const [
    status,
    setStatus,
  ] = useState("PAID");

  const [
    notes,
    setNotes,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    loadingOptions,
    setLoadingOptions,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    async function loadOptions() {
      try {
        const [
          propertyResponse,
          unitResponse,
        ] = await Promise.all([
          apiFetch<
            ListResponse<Property>
          >("/properties"),

          apiFetch<
            ListResponse<Unit>
          >("/units"),
        ]);

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
            : "Unable to load expense options.",
        );
      } finally {
        setLoadingOptions(
          false,
        );
      }
    }

    void loadOptions();
  }, []);

  const propertyUnits =
    useMemo(
      () =>
        units.filter(
          (unit) =>
            unit.property_id ===
            propertyId,
        ),
      [units, propertyId],
    );

  function changeProperty(
    nextPropertyId: string,
  ) {
    setPropertyId(
      nextPropertyId,
    );

    setUnitId("");
  }

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const response =
        await apiFetch<CreateResponse>(
          "/expenses",
          {
            method: "POST",

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

              status,

              notes:
                notes || null,
            }),
          },
        );

      router.replace(
        `/expenses/${response.data.id}`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to record expense.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className={styles.page}
    >
      <div
        className={styles.shell}
        style={{
          maxWidth: 850,
        }}
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

            <h1>
              Record expense
            </h1>

            <p>
              Add a property,
              unit or
              organisation-wide
              operating cost.
            </p>
          </div>
        </header>

        <section
          className={styles.card}
        >
          {loadingOptions ? (
            <div
              className={
                styles.empty
              }
            >
              Loading properties…
            </div>
          ) : (
            <form
              className={
                styles.form
              }
              onSubmit={submit}
            >
              <div
                className={
                  styles.grid
                }
              >
                <label>
                  Property

                  <select
                    value={
                      propertyId
                    }
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
                      (
                        property,
                      ) => (
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
                          key={
                            value
                          }
                          value={
                            value
                          }
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
                    placeholder="e.g. Generator servicing"
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
                    placeholder="50000"
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
                    value={
                      vendorName
                    }
                    placeholder="Optional"
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
                    value={
                      reference
                    }
                    placeholder="Invoice or transfer reference"
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
                    onChange={(
                      event,
                    ) =>
                      setPaymentMethod(
                        event.target
                          .value,
                      )
                    }
                  >
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
                    <option value="PAID">
                      Paid
                    </option>

                    <option value="PENDING">
                      Pending
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
                    placeholder="Optional internal notes"
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
                  Cancel
                </Link>

                <button
                  type="submit"
                  className={
                    styles.primary
                  }
                  disabled={
                    loading ||
                    !description ||
                    !amount
                  }
                >
                  {loading
                    ? "Recording..."
                    : "Record expense"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
