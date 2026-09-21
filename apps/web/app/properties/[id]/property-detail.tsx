"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";

import { apiFetch } from "../../../lib/api";
import styles from "./property-detail.module.css";

type Property = {
  id: string;
  name: string;
  address: string;
  property_type: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  description?: string | null;
  status?: string | null;
  is_published?: boolean;
};

type Unit = {
  id: string;
  property_id: string;
  unit_number: string;
  unit_type: string;
  bedrooms: number | null;
  bathrooms: number | string | null;
  floor?: string | null;
  monthly_rent: number | string;
  security_deposit?: number | string | null;
  status: string;
};

type Payload = {
  property?: Property;
  units?: Unit[];
  summary?: {
    totalUnits?: number;
    vacantUnits?: number;
    occupiedUnits?: number;
    monthlyRent?: number | string;
  };
} & Partial<Property>;

type Response = {
  success: true;
  data: Payload;
};

function money(value: number | string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

export default function PropertyDetail({
  propertyId,
}: {
  propertyId: string;
}) {
  const [property, setProperty] =
    useState<Property | null>(null);

  const [units, setUnits] =
    useState<Unit[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [
    publishing,
    setPublishing,
  ] = useState(false);

  const [
    publishMessage,
    setPublishMessage,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    async function load() {
      try {
        setError(null);

        const response =
          await apiFetch<Response>(
            `/properties/${propertyId}`,
          );

        const payload = response.data;

        const resolvedProperty =
          payload.property ??
          (payload as Property);

        setProperty(resolvedProperty);
        setUnits(payload.units ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load property.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [propertyId]);

  const stats = useMemo(() => {
    const occupied = units.filter(
      (unit) =>
        unit.status === "OCCUPIED",
    ).length;

    const vacant = units.filter(
      (unit) =>
        unit.status === "VACANT",
    ).length;

    const monthlyRent = units
      .filter(
        (unit) =>
          unit.status !== "INACTIVE",
      )
      .reduce(
        (sum, unit) =>
          sum +
          Number(
            unit.monthly_rent || 0,
          ),
        0,
      );

    const occupancy =
      units.length > 0
        ? Math.round(
            (occupied / units.length) *
              100,
          )
        : 0;

    return {
      occupied,
      vacant,
      monthlyRent,
      occupancy,
    };
  }, [units]);

  async function toggleMarketplace() {
    if (!property) {
      return;
    }

    try {
      setPublishing(true);
      setPublishMessage(null);

      const nextState =
        !property.is_published;

      await apiFetch<{
        success: true;
        data: {
          propertyId: string;
          isPublished: boolean;
          availableUnits: number;
        };
      }>(
        `/properties/${property.id}/marketplace`,
        {
          method: "PATCH",

          body: JSON.stringify({
            isPublished:
              nextState,
          }),
        },
      );

      setProperty({
        ...property,
        is_published:
          nextState,
      });

      setPublishMessage(
        nextState
          ? "Property is now visible on the public marketplace."
          : "Property has been removed from the public marketplace.",
      );
    } catch (err) {
      setPublishMessage(
        err instanceof Error
          ? err.message
          : "Unable to update marketplace publishing.",
      );
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.loading}>
            Loading property…
          </div>
        </div>
      </main>
    );
  }

  if (error || !property) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.error}>
            {error ??
              "Property not found."}
          </div>
        </div>
      </main>
    );
  }

  const location = [
    property.address,
    property.city,
    property.state,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topbar}>
          <div className={styles.breadcrumbs}>
            <Link href="/dashboard">
              Dashboard
            </Link>

            <span>/</span>

            <span>Property</span>
          </div>

          <div className={styles.topActions}>
            <button
              type="button"
              className={
                property.is_published
                  ? styles.secondaryButton
                  : styles.primaryButton
              }
              onClick={
                toggleMarketplace
              }
              disabled={
                publishing
              }
            >
              {publishing
                ? "Updating…"
                : property.is_published
                  ? "Unpublish"
                  : "Publish to marketplace"}
            </button>

            {property.is_published ? (
              <Link
                href={`/marketplace/${property.id}`}
                className={
                  styles.secondaryButton
                }
              >
                View listing
              </Link>
            ) : null}

            <Link
              href="/tenants/new"
              className={styles.secondaryButton}
            >
              Add tenant
            </Link>

            <Link
              href="/leases"
              className={styles.primaryButton}
            >
              View leases
            </Link>
          </div>
        </nav>

        {publishMessage ? (
          <div
            className={
              styles.marketplaceNotice
            }
          >
            {publishMessage}
          </div>
        ) : null}

        <section className={styles.hero}>
          <div className={styles.propertyMark}>
            {property.name
              .slice(0, 2)
              .toUpperCase()}
          </div>

          <div className={styles.heroContent}>
            <div className={styles.heroMeta}>
              <span
                className={styles.typeBadge}
              >
                {humanize(
                  property.property_type,
                )}
              </span>

              <span
                className={styles.statusBadge}
              >
                {humanize(
                  property.status ??
                    "ACTIVE",
                )}
              </span>
            </div>

            <h1>{property.name}</h1>

            <p className={styles.address}>
              {location}
            </p>

            {property.description ? (
              <p
                className={
                  styles.description
                }
              >
                {property.description}
              </p>
            ) : null}
          </div>

          <div className={styles.heroAction}>
            <Link
              href="/maintenance/new"
              className={styles.outlineButton}
            >
              Report maintenance
            </Link>
          </div>
        </section>

        <section className={styles.metrics}>
          <article className={styles.metricCard}>
            <span>Total units</span>
            <strong>{units.length}</strong>
            <small>
              Rental spaces in this
              property
            </small>
          </article>

          <article className={styles.metricCard}>
            <span>Vacant</span>
            <strong>
              {stats.vacant}
            </strong>
            <small>
              Available for a new lease
            </small>
          </article>

          <article className={styles.metricCard}>
            <span>Occupied</span>
            <strong>
              {stats.occupied}
            </strong>
            <small>
              Units with active tenants
            </small>
          </article>

          <article className={styles.metricCard}>
            <span>Monthly rent</span>
            <strong>
              {money(
                stats.monthlyRent,
              )}
            </strong>
            <small>
              Current listed monthly rent
            </small>
          </article>
        </section>

        <section className={styles.occupancyCard}>
          <div>
            <span className={styles.sectionLabel}>
              PORTFOLIO HEALTH
            </span>

            <h2>Occupancy</h2>

            <p>
              {stats.occupied} of{" "}
              {units.length} units are
              currently occupied.
            </p>
          </div>

          <div className={styles.occupancyRight}>
            <strong>
              {stats.occupancy}%
            </strong>

            <div
              className={styles.progress}
              aria-label={`${stats.occupancy}% occupied`}
            >
              <div
                className={styles.progressValue}
                style={{
                  width: `${stats.occupancy}%`,
                }}
              />
            </div>
          </div>
        </section>

        <section className={styles.unitsSection}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.sectionLabel}>
                RENTABLE UNITS
              </span>

              <h2>Units</h2>

              <p>
                View rent, occupancy and
                lease actions for every
                unit.
              </p>
            </div>

            <Link
              href="/tenants/new"
              className={styles.secondaryButton}
            >
              + Add tenant
            </Link>
          </div>

          {units.length === 0 ? (
            <div className={styles.empty}>
              <div
                className={styles.emptyIcon}
              >
                U
              </div>

              <h3>No units yet</h3>

              <p>
                This property does not
                have any rentable units
                configured.
              </p>
            </div>
          ) : (
            <div className={styles.unitGrid}>
              {units.map((unit) => {
                const occupied =
                  unit.status ===
                  "OCCUPIED";

                return (
                  <article
                    key={unit.id}
                    className={
                      styles.unitCard
                    }
                  >
                    <div
                      className={
                        styles.unitTop
                      }
                    >
                      <div>
                        <span
                          className={
                            styles.unitLabel
                          }
                        >
                          UNIT
                        </span>

                        <h3>
                          Unit{" "}
                          {
                            unit.unit_number
                          }
                        </h3>
                      </div>

                      <span
                        className={
                          occupied
                            ? styles.occupied
                            : unit.status ===
                                "VACANT"
                              ? styles.vacant
                              : styles.neutral
                        }
                      >
                        <i />
                        {humanize(
                          unit.status,
                        )}
                      </span>
                    </div>

                    <div
                      className={
                        styles.unitDetails
                      }
                    >
                      <span>
                        {humanize(
                          unit.unit_type,
                        )}
                      </span>

                      <span>
                        {unit.bedrooms ??
                          0}{" "}
                        bed
                      </span>

                      <span>
                        {Number(
                          unit.bathrooms ??
                            0,
                        )}{" "}
                        bath
                      </span>

                      {unit.floor ? (
                        <span>
                          Floor{" "}
                          {unit.floor}
                        </span>
                      ) : null}
                    </div>

                    <div
                      className={
                        styles.rentBlock
                      }
                    >
                      <small>
                        MONTHLY RENT
                      </small>

                      <strong>
                        {money(
                          unit.monthly_rent,
                        )}
                      </strong>
                    </div>

                    <div
                      className={
                        styles.unitFooter
                      }
                    >
                      {occupied ? (
                        <Link
                          href="/leases"
                          className={
                            styles.unitLink
                          }
                        >
                          View lease →
                        </Link>
                      ) : unit.status ===
                        "VACANT" ? (
                        <Link
                          href={`/leases/new?unitId=${unit.id}`}
                          className={
                            styles.unitLink
                          }
                        >
                          Create lease →
                        </Link>
                      ) : (
                        <span
                          className={
                            styles.disabledAction
                          }
                        >
                          Lease unavailable
                        </span>
                      )}

                      <Link
                        href="/maintenance/new"
                        className={
                          styles.smallLink
                        }
                      >
                        Maintenance
                      </Link>
                    </div>
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
