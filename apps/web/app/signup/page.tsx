"use client";

import {
  FormEvent,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

import styles from "../auth-pages.module.css";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setMessage(null);

    if (!supabaseUrl || !supabaseKey) {
      setError(
        "Supabase browser configuration is missing.",
      );
      return;
    }

    setLoading(true);

    try {
      const supabase =
        createBrowserClient(
          supabaseUrl,
          supabaseKey,
        );

      const {
        data,
        error: signupError,
      } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name:
              fullName.trim(),
          },

          emailRedirectTo:
            `${window.location.origin}` +
            "/auth/callback?next=/onboarding",
        },
      });

      if (signupError) {
        throw signupError;
      }

      if (data.session) {
        router.replace(
          "/onboarding",
        );
        router.refresh();
        return;
      }

      setMessage(
        "Account created. Check your email to confirm your address, then sign in.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create your account.",
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
            RENTAL OPERATIONS
          </span>

          <h2>
            Run your properties with
            clarity.
          </h2>

          <p>
            Track properties, tenants,
            leases, rent, maintenance
            and documents from one
            secure workspace.
          </p>

          <div className={styles.points}>
            <div className={styles.point}>
              <span className={styles.check}>
                ✓
              </span>
              Organisation-isolated data
            </div>

            <div className={styles.point}>
              <span className={styles.check}>
                ✓
              </span>
              Rent and overdue tracking
            </div>

            <div className={styles.point}>
              <span className={styles.check}>
                ✓
              </span>
              Secure private documents
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
              CREATE YOUR WORKSPACE
            </span>

            <h1>
              Start managing rent
              clearly.
            </h1>

            <p>
              Create your landlord
              account. You can add your
              first property immediately
              after setup.
            </p>
          </header>

          <form
            className={styles.form}
            onSubmit={submit}
          >
            <div className={styles.field}>
              <label htmlFor="fullName">
                Full name
              </label>

              <input
                id="fullName"
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
                value={fullName}
                placeholder="Olayenikan Michael"
                onChange={(event) =>
                  setFullName(
                    event.target.value,
                  )
                }
              />
            </div>

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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                placeholder="Minimum 8 characters"
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
              />

              <small
                className={
                  styles.passwordHint
                }
              >
                Use at least 8 characters.
              </small>
            </div>

            {error ? (
              <div
                className={styles.error}
                role="alert"
              >
                {error}
              </div>
            ) : null}

            {message ? (
              <div
                className={styles.success}
              >
                {message}
              </div>
            ) : null}

            <button
              className={styles.submit}
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Creating account..."
                : "Create account"}
            </button>
          </form>

          <p className={styles.switch}>
            Already have an account?{" "}
            <Link href="/login">
              Sign in
            </Link>
          </p>

          <p className={styles.legal}>
            By creating an account, you
            agree to use RentPilot
            responsibly and keep your
            account credentials secure.
          </p>
        </div>
      </section>
    </main>
  );
}
