"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  apiFetch,
} from "../../../lib/api";

import styles from "../../management.module.css";

type Tenant = {
  id: string;
  full_name: string;
  status: string;
};

type Unit = {
  id: string;
  property_id: string;
  unit_number: string;
  unit_type: string | null;
  monthly_rent: string | number;
  status: string;
};

type TenantsResponse = {
  success: true;
  data: Tenant[];
};

type UnitsResponse = {
  success: true;
  data: Unit[];
};

type LeaseResponse = {
  success: true;

  data: {
    leaseId: string;
  };
};

const FREQUENCIES = [
  "MONTHLY",
  "QUARTERLY",
  "BIANNUAL",
  "ANNUAL",
  "CUSTOM",
] as const;

export default function LeaseForm({
  initialTenantId,
  initialUnitId,
}: {
  initialTenantId: string;
  initialUnitId: string;
}) {
  const router = useRouter();

  const [tenants, setTenants] =
    useState<Tenant[]>([]);

  const [units, setUnits] =
    useState<Unit[]>([]);

  const [tenantId, setTenantId] =
    useState(initialTenantId);

  const [unitId, setUnitId] =
    useState(initialUnitId);

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [rentAmount, setRentAmount] =
    useState("");

  const [
    paymentFrequency,
    setPaymentFrequency,
  ] = useState("ANNUAL");

  const [
    securityDeposit,
    setSecurityDeposit,
  ] = useState("");

  const [
    gracePeriodDays,
    setGracePeriodDays,
  ] = useState("0");

  const [lateFee, setLateFee] =
    useState("0");

  const [notes, setNotes] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [loadingOptions, setLoadingOptions] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [
          tenantResponse,
          unitResponse,
        ] = await Promise.all([
          apiFetch<TenantsResponse>(
            "/tenants",
          ),

          apiFetch<UnitsResponse>(
            "/units",
          ),
        ]);

        setTenants(
          tenantResponse.data.filter(
            (tenant) =>
              tenant.status ===
              "ACTIVE",
          ),
        );

        setUnits(
          unitResponse.data.filter(
            (unit) =>
              unit.status !==
                "MAINTENANCE" &&
              unit.status !==
                "INACTIVE",
          ),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load lease options.",
        );
      } finally {
        setLoadingOptions(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    const unit =
      units.find(
        (item) =>
          item.id === unitId,
      );

    if (
      unit &&
      rentAmount === ""
    ) {
      setRentAmount(
        String(
          unit.monthly_rent ?? "",
        ),
      );
    }
  }, [
    unitId,
    units,
    rentAmount,
  ]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const response =
        await apiFetch<LeaseResponse>(
          "/leases",
          {
            method: "POST",

            body: JSON.stringify({
              tenantId,
              unitId,
              startDate,
              endDate,
              rentAmount:
                Number(rentAmount),

              paymentFrequency,

              securityDeposit:
                Number(
                  securityDeposit ||
                    0,
                ),

              gracePeriodDays:
                Number(
                  gracePeriodDays ||
                    0,
                ),

              lateFee:
                Number(
                  lateFee || 0,
                ),

              status:
                "ACTIVE",

              notes:
                notes ||
                undefined,
            }),
          },
        );

      router.replace(
        `/leases?created=${response.data.leaseId}`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create lease.",
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
            href="/dashboard"
          >
            ← Dashboard
          </Link>

          <nav className={styles.nav}>
            <Link href="/tenants">
              Tenants
            </Link>

            <Link href="/leases">
              Leases
            </Link>
          </nav>
        </div>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>
              LEASE SETUP
            </span>

            <h1>Create a lease.</h1>

            <p>
              Connect an active tenant to
              one rentable unit.
            </p>
          </div>
        </header>

        <section className={styles.card}>
          {loadingOptions ? (
            <div className={styles.empty}>
              Loading tenants and units…
            </div>
          ) : (
            <form
              className={styles.form}
              onSubmit={handleSubmit}
            >
              <div className={styles.grid}>
                <label>
                  Tenant

                  <select
                    required
                    value={tenantId}
                    onChange={(event) =>
                      setTenantId(
                        event.target.value,
                      )
                    }
                  >
                    <option value="">
                      Choose tenant
                    </option>

                    {tenants.map(
                      (tenant) => (
                        <option
                          key={tenant.id}
                          value={tenant.id}
                        >
                          {tenant.full_name}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  Unit

                  <select
                    required
                    value={unitId}
                    onChange={(event) => {
                      setUnitId(
                        event.target.value,
                      );

                      setRentAmount("");
                    }}
                  >
                    <option value="">
                      Choose unit
                    </option>

                    {units.map(
                      (unit) => (
                        <option
                          key={unit.id}
                          value={unit.id}
                        >
                          {unit.unit_number}
                          {" · "}
                          {unit.unit_type ??
                            "Unit"}
                          {" · "}
                          {unit.status}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  Start date

                  <input
                    required
                    type="date"
                    value={startDate}
                    onChange={(event) =>
                      setStartDate(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  End date

                  <input
                    required
                    type="date"
                    value={endDate}
                    onChange={(event) =>
                      setEndDate(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  Rent amount

                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={rentAmount}
                    onChange={(event) =>
                      setRentAmount(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  Payment frequency

                  <select
                    value={
                      paymentFrequency
                    }
                    onChange={(event) =>
                      setPaymentFrequency(
                        event.target.value,
                      )
                    }
                  >
                    {FREQUENCIES.map(
                      (frequency) => (
                        <option
                          key={frequency}
                          value={frequency}
                        >
                          {frequency.replaceAll(
                            "_",
                            " ",
                          )}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  Security deposit

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      securityDeposit
                    }
                    onChange={(event) =>
                      setSecurityDeposit(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  Grace period

                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={
                      gracePeriodDays
                    }
                    onChange={(event) =>
                      setGracePeriodDays(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  Late fee

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={lateFee}
                    onChange={(event) =>
                      setLateFee(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className={styles.full}>
                  Notes

                  <textarea
                    rows={4}
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
                  className={styles.error}
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              <div className={styles.actions}>
                <Link
                  className={styles.secondary}
                  href="/leases"
                >
                  Cancel
                </Link>

                <button
                  className={styles.primary}
                  type="submit"
                  disabled={loading}
                >
                  {loading
                    ? "Creating lease..."
                    : "Create active lease"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
