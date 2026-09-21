"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { apiFetch } from "../../lib/api";
import styles from "../auth-pages.module.css";

type OnboardingStatusResponse = {
  success: true;

  data?: {
    memberships?: unknown[];
  };

  memberships?: unknown[];
};

export default function OnboardingForm() {
  const router = useRouter();

  const [fullName, setFullName] =
    useState("");

  const [
    organisationName,
    setOrganisationName,
  ] = useState("");

  const [phone, setPhone] =
    useState("");

  const [countryCode, setCountryCode] =
    useState("NG");

  const [currency, setCurrency] =
    useState("NGN");

  const [loading, setLoading] =
    useState(false);

  const [checking, setChecking] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const response =
          await apiFetch<OnboardingStatusResponse>(
            "/onboarding/status",
          );

        const memberships =
          response.data?.memberships ??
          response.memberships ??
          [];

        if (memberships.length > 0) {
          router.replace("/dashboard");
          return;
        }
      } catch {
        // The form can still render.
        // Submission will surface any real API error.
      } finally {
        setChecking(false);
      }
    }

    void checkStatus();
  }, [router]);

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setLoading(true);

    try {
      await apiFetch(
        "/onboarding/landlord",
        {
          method: "POST",

          body: JSON.stringify({
            fullName:
              fullName.trim(),

            organisationName:
              organisationName.trim(),

            phone:
              phone.trim(),

            countryCode,

            currency,
          }),
        },
      );

      router.replace(
        "/properties/new",
      );

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create your workspace.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className={styles.page}>
        <section
          className={styles.brandPanel}
        >
          <Link
            className={styles.brand}
            href="/"
          >
            <span className={styles.logo}>
              R
            </span>

            RentPilot
          </Link>

          <div
            className={styles.brandCopy}
          >
            <span
              className={styles.eyebrow}
            >
              RENTAL OPERATIONS
            </span>

            <h2>
              One workspace for your
              rental business.
            </h2>
          </div>
        </section>

        <section
          className={styles.formPanel}
        >
          <div className={styles.card}>
            <p>
              Preparing your workspace…
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section
        className={styles.brandPanel}
      >
        <Link
          className={styles.brand}
          href="/"
        >
          <span className={styles.logo}>
            R
          </span>

          RentPilot
        </Link>

        <div
          className={styles.brandCopy}
        >
          <span
            className={styles.eyebrow}
          >
            WORKSPACE SETUP
          </span>

          <h2>
            Build the operating system
            for your rental portfolio.
          </h2>

          <p>
            Your RentPilot workspace
            keeps properties, units,
            tenants, leases, rent,
            maintenance and documents
            organised under one
            business account.
          </p>

          <div className={styles.points}>
            <div className={styles.point}>
              <span className={styles.check}>
                ✓
              </span>
              Separate business workspace
            </div>

            <div className={styles.point}>
              <span className={styles.check}>
                ✓
              </span>
              Organisation-based access
              control
            </div>

            <div className={styles.point}>
              <span className={styles.check}>
                ✓
              </span>
              Add managers and staff later
            </div>
          </div>
        </div>

        <small
          className={styles.copyright}
        >
          RENTpilot · Rental management
          infrastructure
        </small>
      </section>

      <section
        className={styles.formPanel}
      >
        <div className={styles.card}>
          <Link
            className={styles.mobileBrand}
            href="/"
          >
            RentPilot
          </Link>

          <header
            className={styles.cardHeader}
          >
            <span>
              SET UP YOUR WORKSPACE
            </span>

            <h1>
              Tell us about your rental
              business.
            </h1>

            <p>
              Start with the basics.
              You can add properties,
              units and tenants next.
            </p>
          </header>

          <form
            className={styles.form}
            onSubmit={submit}
          >
            <div
              className={styles.formGrid}
            >
              <div
                className={`${styles.field} ${styles.full}`}
              >
                <label htmlFor="fullName">
                  Your full name
                </label>

                <input
                  id="fullName"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Olayenikan Michael"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(
                      event.target.value,
                    )
                  }
                />
              </div>

              <div
                className={`${styles.field} ${styles.full}`}
              >
                <label
                  htmlFor="organisationName"
                >
                  Organisation or
                  business name
                </label>

                <input
                  id="organisationName"
                  required
                  minLength={2}
                  maxLength={150}
                  placeholder="Michael Properties"
                  value={
                    organisationName
                  }
                  onChange={(event) =>
                    setOrganisationName(
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="phone">
                  Phone number
                </label>

                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+234 801 234 5678"
                  value={phone}
                  onChange={(event) =>
                    setPhone(
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="country">
                  Country
                </label>

                <select
                  id="country"
                  value={countryCode}
                  onChange={(event) => {
                    const value =
                      event.target.value;

                    setCountryCode(value);

                    if (value === "NG") {
                      setCurrency("NGN");
                    }

                    if (value === "GH") {
                      setCurrency("GHS");
                    }

                    if (value === "KE") {
                      setCurrency("KES");
                    }

                    if (value === "ZA") {
                      setCurrency("ZAR");
                    }

                    if (value === "GB") {
                      setCurrency("GBP");
                    }

                    if (value === "US") {
                      setCurrency("USD");
                    }
                  }}
                >
                  <option value="NG">
                    Nigeria
                  </option>

                  <option value="GH">
                    Ghana
                  </option>

                  <option value="KE">
                    Kenya
                  </option>

                  <option value="ZA">
                    South Africa
                  </option>

                  <option value="GB">
                    United Kingdom
                  </option>

                  <option value="US">
                    United States
                  </option>
                </select>
              </div>

              <div
                className={`${styles.field} ${styles.full}`}
              >
                <label htmlFor="currency">
                  Default currency
                </label>

                <select
                  id="currency"
                  value={currency}
                  onChange={(event) =>
                    setCurrency(
                      event.target.value,
                    )
                  }
                >
                  <option value="NGN">
                    Nigerian Naira (NGN)
                  </option>

                  <option value="GHS">
                    Ghanaian Cedi (GHS)
                  </option>

                  <option value="KES">
                    Kenyan Shilling (KES)
                  </option>

                  <option value="ZAR">
                    South African Rand
                    (ZAR)
                  </option>

                  <option value="GBP">
                    British Pound (GBP)
                  </option>

                  <option value="USD">
                    US Dollar (USD)
                  </option>
                </select>
              </div>
            </div>

            {error ? (
              <div
                className={styles.error}
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <button
              className={styles.submit}
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Creating workspace..."
                : "Create workspace"}
            </button>
          </form>

          <div className={styles.note}>
            You can invite property
            managers, accountants and
            staff after setup.
          </div>
        </div>
      </section>
    </main>
  );
}
