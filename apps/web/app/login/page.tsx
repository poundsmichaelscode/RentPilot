"use client";

import {
  FormEvent,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "../auth-pages.module.css";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);

    setLoading(true);

    try {
      const response =
        await fetch(
          "/auth/sign-in",
          {
            method: "POST",

            credentials:
              "same-origin",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              email:
                email.trim(),
              password,
            }),
          },
        );

      const result =
        (await response.json()) as {
          success?: boolean;
          message?: string;
        };

      if (!response.ok) {
        throw new Error(
          result.message ??
            "Unable to sign in.",
        );
      }

      router.replace(
        "/dashboard",
      );

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in.",
      );
    } finally {
      setLoading(false);
    }
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
            WELCOME BACK
          </span>

          <h2>
            Your rental portfolio,
            under control.
          </h2>

          <p>
            Sign in to review rent,
            leases, tenants, maintenance
            and secure property
            documents.
          </p>

          <div className={styles.points}>
            <div className={styles.point}>
              <span className={styles.check}>
                ✓
              </span>
              See overdue rent quickly
            </div>

            <div className={styles.point}>
              <span className={styles.check}>
                ✓
              </span>
              Manage active leases
            </div>

            <div className={styles.point}>
              <span className={styles.check}>
                ✓
              </span>
              Keep property operations
              organized
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
              SECURE SIGN IN
            </span>

            <h1>
              Welcome back.
            </h1>

            <p>
              Sign in to continue to
              your RentPilot workspace.
            </p>
          </header>

          <form
            className={styles.form}
            onSubmit={submit}
          >
            <div className={styles.field}>
              <label htmlFor="email">
                Email address
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                placeholder="you@example.com"
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password">
                Password
              </label>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                placeholder="Your password"
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
              />
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
                ? "Signing in..."
                : "Sign in"}
            </button>
          </form>

          <p className={styles.switch}>
            New to RentPilot?{" "}
            <Link href="/signup">
              Create account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
