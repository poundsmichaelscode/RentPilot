"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { apiFetch } from "../../../lib/api";
import styles from "../../management.module.css";

type Property = {
  id: string;
  name: string;
};

type Unit = {
  id: string;
  property_id: string;
  unit_number: string;
  status: string;
};

type Tenant = {
  id: string;
  full_name: string;
  status: string;
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

export default function MaintenanceForm() {
  const router = useRouter();

  const [properties, setProperties] =
    useState<Property[]>([]);

  const [units, setUnits] =
    useState<Unit[]>([]);

  const [tenants, setTenants] =
    useState<Tenant[]>([]);

  const [propertyId, setPropertyId] =
    useState("");

  const [unitId, setUnitId] =
    useState("");

  const [tenantId, setTenantId] =
    useState("");

  const [title, setTitle] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [category, setCategory] =
    useState("OTHER");

  const [priority, setPriority] =
    useState("NORMAL");

  const [loading, setLoading] =
    useState(false);

  const [loadingOptions, setLoadingOptions] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [
          propertyResponse,
          unitResponse,
          tenantResponse,
        ] = await Promise.all([
          apiFetch<ListResponse<Property>>(
            "/properties",
          ),
          apiFetch<ListResponse<Unit>>(
            "/units",
          ),
          apiFetch<ListResponse<Tenant>>(
            "/tenants",
          ),
        ]);

        setProperties(
          propertyResponse.data,
        );

        setUnits(
          unitResponse.data,
        );

        setTenants(
          tenantResponse.data.filter(
            (tenant) =>
              tenant.status === "ACTIVE",
          ),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load maintenance options.",
        );
      } finally {
        setLoadingOptions(false);
      }
    }

    void loadOptions();
  }, []);

  const propertyUnits = useMemo(
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
    setPropertyId(nextPropertyId);
    setUnitId("");
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const response =
        await apiFetch<CreateResponse>(
          "/maintenance",
          {
            method: "POST",
            body: JSON.stringify({
              propertyId,
              unitId:
                unitId || null,
              tenantId:
                tenantId || null,
              title,
              description,
              category,
              priority,
            }),
          },
        );

      router.replace(
        `/maintenance/${response.data.id}`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create maintenance request.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div
        className={styles.shell}
        style={{ maxWidth: 850 }}
      >
        <div className={styles.topbar}>
          <Link
            className={styles.back}
            href="/maintenance"
          >
            ← Maintenance
          </Link>
        </div>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>
              PROPERTY OPERATIONS
            </span>

            <h1>
              New maintenance request
            </h1>

            <p>
              Record a repair, fault or
              operational issue.
            </p>
          </div>
        </header>

        <section className={styles.card}>
          {loadingOptions ? (
            <div className={styles.empty}>
              Loading properties…
            </div>
          ) : properties.length === 0 ? (
            <div className={styles.empty}>
              Add a property before
              creating maintenance
              requests.
            </div>
          ) : (
            <form
              className={styles.form}
              onSubmit={submit}
            >
              <div className={styles.grid}>
                <label>
                  Property

                  <select
                    required
                    value={propertyId}
                    onChange={(event) =>
                      changeProperty(
                        event.target.value,
                      )
                    }
                  >
                    <option value="">
                      Choose property
                    </option>

                    {properties.map(
                      (property) => (
                        <option
                          key={property.id}
                          value={
                            property.id
                          }
                        >
                          {property.name}
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
                    onChange={(event) =>
                      setUnitId(
                        event.target.value,
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
                          key={unit.id}
                          value={unit.id}
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
                  Tenant

                  <select
                    value={tenantId}
                    onChange={(event) =>
                      setTenantId(
                        event.target.value,
                      )
                    }
                  >
                    <option value="">
                      No tenant linked
                    </option>

                    {tenants.map(
                      (tenant) => (
                        <option
                          key={tenant.id}
                          value={tenant.id}
                        >
                          {
                            tenant.full_name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  Priority

                  <select
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
                </label>

                <label>
                  Category

                  <select
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
                </label>

                <label
                  className={styles.full}
                >
                  Title

                  <input
                    required
                    minLength={3}
                    maxLength={200}
                    value={title}
                    placeholder="e.g. Kitchen sink leaking"
                    onChange={(event) =>
                      setTitle(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label
                  className={styles.full}
                >
                  Description

                  <textarea
                    required
                    minLength={3}
                    maxLength={5000}
                    rows={6}
                    value={description}
                    placeholder="Describe the problem and any useful details."
                    onChange={(event) =>
                      setDescription(
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

              <div
                className={styles.actions}
              >
                <Link
                  className={
                    styles.secondary
                  }
                  href="/maintenance"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  className={styles.primary}
                  disabled={
                    loading ||
                    !propertyId
                  }
                >
                  {loading
                    ? "Creating..."
                    : "Create request"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
