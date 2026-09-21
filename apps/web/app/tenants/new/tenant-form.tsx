"use client";

import {
  FormEvent,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  apiFetch,
} from "../../../lib/api";

import styles from "../../management.module.css";

type TenantResponse = {
  success: true;

  data: {
    tenantId: string;
  };
};

export default function TenantForm() {
  const router = useRouter();

  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [
    emergencyContactName,
    setEmergencyContactName,
  ] = useState("");

  const [
    emergencyContactPhone,
    setEmergencyContactPhone,
  ] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const response =
        await apiFetch<TenantResponse>(
          "/tenants",
          {
            method: "POST",

            body: JSON.stringify({
              fullName,
              email,
              phone,
              emergencyContactName,
              emergencyContactPhone,
            }),
          },
        );

      router.replace(
        `/leases/new?tenantId=${response.data.tenantId}`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add tenant.",
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
              TENANT SETUP
            </span>

            <h1>Add a tenant.</h1>

            <p>
              A tenant can be added before
              they create their own RentPilot
              login.
            </p>
          </div>
        </header>

        <section className={styles.card}>
          <form
            className={styles.form}
            onSubmit={handleSubmit}
          >
            <div className={styles.grid}>
              <label className={styles.full}>
                Full name

                <input
                  required
                  minLength={2}
                  maxLength={150}
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Email

                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Phone

                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="+234..."
                  value={phone}
                  onChange={(event) =>
                    setPhone(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Emergency contact

                <input
                  value={
                    emergencyContactName
                  }
                  onChange={(event) =>
                    setEmergencyContactName(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Emergency phone

                <input
                  type="tel"
                  value={
                    emergencyContactPhone
                  }
                  onChange={(event) =>
                    setEmergencyContactPhone(
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
                href="/tenants"
              >
                Cancel
              </Link>

              <button
                className={styles.primary}
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Adding tenant..."
                  : "Add tenant & create lease"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
