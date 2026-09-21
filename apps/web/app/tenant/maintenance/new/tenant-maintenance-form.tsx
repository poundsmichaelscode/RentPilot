"use client";

import {
  FormEvent,
  useState,
} from "react";

import Link from "next/link";
import {
  useRouter,
} from "next/navigation";

import {
  apiFetch,
} from "../../../../lib/api";

import styles from "../../tenant.module.css";

export default function TenantMaintenanceForm() {
  const router =
    useRouter();

  const [title, setTitle] =
    useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [category, setCategory] =
    useState("OTHER");

  const [priority, setPriority] =
    useState("NORMAL");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      await apiFetch(
        "/tenant-portal/maintenance",
        {
          method: "POST",

          body: JSON.stringify({
            title:
              title.trim(),

            description:
              description.trim(),

            category,
            priority,
          }),
        },
      );

      router.replace(
        "/dashboard",
      );

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit maintenance request.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topbar}>
          <Link
            className={styles.back}
            href="/dashboard"
          >
            ← My dashboard
          </Link>

          <div className={styles.nav}>
            <Link href="/tenant/lease">
              My lease
            </Link>

            <Link href="/tenant/payments">
              Payments
            </Link>
          </div>
        </nav>

        <header className={styles.hero}>
          <span className={styles.eyebrow}>
            MAINTENANCE
          </span>

          <h1>
            Report an issue.
          </h1>

          <p>
            Tell your landlord or
            property manager what needs
            attention in your current
            rental unit.
          </p>
        </header>

        <section className={styles.section}>
          <article className={styles.card}>
            <form
              className={styles.form}
              onSubmit={submit}
            >
              <div
                className={
                  styles.formGrid
                }
              >
                <div
                  className={
                    styles.fieldFull
                  }
                >
                  <label htmlFor="title">
                    Issue title
                  </label>

                  <input
                    id="title"
                    required
                    minLength={3}
                    maxLength={200}
                    value={title}
                    placeholder="e.g. Kitchen tap is leaking"
                    onChange={(event) =>
                      setTitle(
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="category">
                    Category
                  </label>

                  <select
                    id="category"
                    value={category}
                    onChange={(event) =>
                      setCategory(
                        event.target.value,
                      )
                    }
                  >
                    <option value="PLUMBING">
                      Plumbing
                    </option>

                    <option value="ELECTRICAL">
                      Electrical
                    </option>

                    <option value="WATER">
                      Water
                    </option>

                    <option value="SECURITY">
                      Security
                    </option>

                    <option value="APPLIANCE">
                      Appliance
                    </option>

                    <option value="STRUCTURAL">
                      Structural
                    </option>

                    <option value="CLEANING">
                      Cleaning
                    </option>

                    <option value="OTHER">
                      Other
                    </option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label htmlFor="priority">
                    Priority
                  </label>

                  <select
                    id="priority"
                    value={priority}
                    onChange={(event) =>
                      setPriority(
                        event.target.value,
                      )
                    }
                  >
                    <option value="LOW">
                      Low
                    </option>

                    <option value="NORMAL">
                      Normal
                    </option>

                    <option value="HIGH">
                      High
                    </option>

                    <option value="URGENT">
                      Urgent
                    </option>
                  </select>
                </div>

                <div
                  className={
                    styles.fieldFull
                  }
                >
                  <label htmlFor="description">
                    What happened?
                  </label>

                  <textarea
                    id="description"
                    required
                    minLength={5}
                    maxLength={5000}
                    value={description}
                    placeholder="Describe the problem, where it is, and anything the property manager should know."
                    onChange={(event) =>
                      setDescription(
                        event.target.value,
                      )
                    }
                  />
                </div>
              </div>

              {error ? (
                <div className={styles.error}>
                  {error}
                </div>
              ) : null}

              <div className={styles.actions}>
                <Link
                  href="/dashboard"
                  className={
                    styles.secondary
                  }
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  className={
                    styles.primary
                  }
                  disabled={loading}
                >
                  {loading
                    ? "Submitting..."
                    : "Submit request"}
                </button>
              </div>
            </form>
          </article>
        </section>
      </div>
    </main>
  );
}
