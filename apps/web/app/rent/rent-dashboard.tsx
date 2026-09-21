"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import { apiFetch } from "../../lib/api";
import styles from "../management.module.css";

type Charge = {
  id: string;
  lease_id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  expected_amount: number | string;
  waived_amount: number | string;
  paid_amount: number;
  balance: number;
  status: string;
};

type Lease = {
  id: string;
  unit_id: string;
  tenant_id: string;
  rent_amount: number | string;
  payment_frequency: string;
  status: string;
};

type Tenant = {
  id: string;
  full_name: string;
};

type Unit = {
  id: string;
  unit_number: string;
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

export default function RentDashboard() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);

      const [
        chargeResponse,
        leaseResponse,
        tenantResponse,
        unitResponse,
      ] = await Promise.all([
        apiFetch<ListResponse<Charge>>("/rent-charges"),
        apiFetch<ListResponse<Lease>>("/leases"),
        apiFetch<ListResponse<Tenant>>("/tenants"),
        apiFetch<ListResponse<Unit>>("/units"),
      ]);

      setCharges(chargeResponse.data);
      setLeases(leaseResponse.data);
      setTenants(tenantResponse.data);
      setUnits(unitResponse.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load rent information.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tenantNames = useMemo(
    () =>
      new Map(
        tenants.map((tenant) => [
          tenant.id,
          tenant.full_name,
        ]),
      ),
    [tenants],
  );

  const unitNames = useMemo(
    () =>
      new Map(
        units.map((unit) => [
          unit.id,
          unit.unit_number,
        ]),
      ),
    [units],
  );

  const leaseById = useMemo(
    () =>
      new Map(
        leases.map((lease) => [
          lease.id,
          lease,
        ]),
      ),
    [leases],
  );

  const outstanding = charges.filter(
    (charge) =>
      !["PAID", "WAIVED"].includes(charge.status),
  );

  const overdue = charges.filter(
    (charge) => charge.status === "OVERDUE",
  );

  const paid = charges.filter(
    (charge) => charge.status === "PAID",
  );

  const totalOutstanding = outstanding.reduce(
    (sum, charge) => sum + Number(charge.balance),
    0,
  );

  const totalOverdue = overdue.reduce(
    (sum, charge) => sum + Number(charge.balance),
    0,
  );

  async function generateCharge(leaseId: string) {
    setGenerating(leaseId);
    setError(null);

    try {
      await apiFetch("/rent-charges/generate", {
        method: "POST",
        body: JSON.stringify({
          leaseId,
        }),
      });

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate rent charge.",
      );
    } finally {
      setGenerating(null);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <Link className={styles.back} href="/dashboard">
            ← Dashboard
          </Link>

          <nav className={styles.nav}>
            <Link href="/leases">Leases</Link>
            <Link href="/payments">Payments</Link>
          </nav>
        </div>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>
              RENT & COLLECTIONS
            </span>

            <h1>Rent</h1>

            <p>
              Track what is due, overdue and already paid.
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
          <div className={styles.error} role="alert">
            {error}
          </div>
        ) : null}

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <article className={styles.card}>
            <small>Outstanding</small>
            <h2>{money(totalOutstanding)}</h2>
            <p>{outstanding.length} open charges</p>
          </article>

          <article className={styles.card}>
            <small>Overdue</small>
            <h2>{money(totalOverdue)}</h2>
            <p>{overdue.length} overdue charges</p>
          </article>

          <article className={styles.card}>
            <small>Paid charges</small>
            <h2>{paid.length}</h2>
            <p>Settled billing periods</p>
          </article>
        </section>

        <section className={styles.card}>
          <div className={styles.header}>
            <div>
              <span className={styles.eyebrow}>
                BILLING
              </span>

              <h2>Active leases</h2>
            </div>
          </div>

          <div className={styles.list}>
            {leases
              .filter((lease) =>
                ["ACTIVE", "EXPIRING_SOON"].includes(
                  lease.status,
                ),
              )
              .map((lease) => (
                <article
                  key={lease.id}
                  className={styles.row}
                >
                  <div>
                    <strong>
                      {tenantNames.get(lease.tenant_id) ??
                        "Tenant"}
                    </strong>

                    <small>
                      {unitNames.get(lease.unit_id) ??
                        "Unit"}
                    </small>
                  </div>

                  <span>
                    {money(lease.rent_amount)}
                  </span>

                  <span>
                    {lease.payment_frequency}
                  </span>

                  {lease.payment_frequency === "CUSTOM" ? (
                    <span>Manual billing</span>
                  ) : (
                    <button
                      className={styles.secondary}
                      type="button"
                      disabled={generating === lease.id}
                      onClick={() =>
                        void generateCharge(lease.id)
                      }
                    >
                      {generating === lease.id
                        ? "Generating..."
                        : "Generate next charge"}
                    </button>
                  )}
                </article>
              ))}
          </div>
        </section>

        <section
          className={styles.card}
          style={{ marginTop: 24 }}
        >
          <div className={styles.header}>
            <div>
              <span className={styles.eyebrow}>
                OPEN BALANCES
              </span>

              <h2>Outstanding rent</h2>
            </div>
          </div>

          {loading ? (
            <div className={styles.empty}>
              Loading rent charges…
            </div>
          ) : outstanding.length === 0 ? (
            <div className={styles.empty}>
              No outstanding rent charges.
            </div>
          ) : (
            <div className={styles.list}>
              {outstanding.map((charge) => {
                const lease =
                  leaseById.get(charge.lease_id);

                return (
                  <article
                    key={charge.id}
                    className={styles.row}
                  >
                    <div>
                      <strong>
                        {lease
                          ? tenantNames.get(
                              lease.tenant_id,
                            ) ?? "Tenant"
                          : "Tenant"}
                      </strong>

                      <small>
                        {lease
                          ? unitNames.get(
                              lease.unit_id,
                            ) ?? "Unit"
                          : "Unit"}
                      </small>
                    </div>

                    <div>
                      <strong>
                        {money(charge.balance)}
                      </strong>

                      <small>
                        of{" "}
                        {money(
                          charge.expected_amount,
                        )}
                      </small>
                    </div>

                    <div>
                      <strong>{charge.status}</strong>

                      <small>
                        Due {charge.due_date}
                      </small>
                    </div>

                    <Link
                      href={`/payments/new?chargeId=${charge.id}`}
                    >
                      Record payment →
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
