"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import styles from "./marketplace-detail.module.css";

type AvailableUnit = {
  id: string;
  unitNumber: string;
  unitType:
    | string
    | null;
  bedrooms:
    | number
    | null;
  bathrooms:
    | number
    | string
    | null;
  floor:
    | string
    | null;
  monthlyRent: number;
  securityDeposit: number;
};

type Listing = {
  id: string;
  name: string;
  propertyType:
    | string
    | null;
  address: string;
  city:
    | string
    | null;
  state:
    | string
    | null;
  country: string;
  description:
    | string
    | null;
  amenities: string[];
  images: string[];
  availableUnits: number;
  rentFrom:
    | number
    | null;
  rentTo:
    | number
    | null;
  bedrooms: number[];
  units: AvailableUnit[];
};

type Response = {
  success: true;
  data: Listing;
};

function money(
  value: number,
) {
  return new Intl.NumberFormat(
    "en-NG",
    {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    },
  ).format(value);
}

function humanize(
  value:
    | string
    | null,
) {
  if (!value) {
    return "Rental property";
  }

  return value
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

export default function MarketplaceDetail({
  propertyId,
}: {
  propertyId: string;
}) {
  const [
    listing,
    setListing,
  ] =
    useState<Listing | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    async function load() {
      try {
        setError(null);

        const response =
          await fetch(
            `/api/marketplace/${propertyId}`,
            {
              cache:
                "no-store",
            },
          );

        if (!response.ok) {
          if (
            response.status ===
            404
          ) {
            throw new Error(
              "This property is not currently available.",
            );
          }

          throw new Error(
            "Unable to load this property.",
          );
        }

        const payload =
          (await response.json()) as
            Response;

        setListing(
          payload.data,
        );
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

  if (loading) {
    return (
      <main
        className={styles.page}
      >
        <div
          className={
            styles.message
          }
        >
          Loading property…
        </div>
      </main>
    );
  }

  if (
    error ||
    !listing
  ) {
    return (
      <main
        className={styles.page}
      >
        <div
          className={
            styles.message
          }
        >
          <h2>
            Property unavailable
          </h2>

          <p>{error}</p>

          <Link href="/marketplace">
            ← Back to marketplace
          </Link>
        </div>
      </main>
    );
  }

  const location =
    [
      listing.address,
      listing.city,
      listing.state,
      listing.country,
    ]
      .filter(Boolean)
      .join(", ");

  return (
    <main
      className={styles.page}
    >
      <nav
        className={styles.nav}
      >
        <Link
          href="/marketplace"
        >
          ← Marketplace
        </Link>

        <Link
          href="/"
          className={styles.brand}
        >
          <span>R</span>
          RentPilot
        </Link>

        <Link href="/login">
          Sign in
        </Link>
      </nav>

      <div
        className={styles.shell}
      >
        <section
          className={styles.hero}
        >
          <div>
            <span
              className={
                styles.eyebrow
              }
            >
              {humanize(
                listing.propertyType,
              )}
            </span>

            <h1>
              {listing.name}
            </h1>

            <p>{location}</p>
          </div>

          <div
            className={
              styles.availability
            }
          >
            <strong>
              {
                listing.availableUnits
              }
            </strong>

            <span>
              {listing.availableUnits ===
              1
                ? "vacant unit"
                : "vacant units"}
            </span>
          </div>
        </section>

        {listing.images.length >
        0 ? (
          <section
            className={
              styles.gallery
            }
          >
            {listing.images
              .slice(0, 4)
              .map(
                (
                  image,
                  index,
                ) => (
                  <img
                    key={image}
                    src={image}
                    alt={`${listing.name} ${index + 1}`}
                  />
                ),
              )}
          </section>
        ) : (
          <div
            className={
              styles.placeholder
            }
          >
            {listing.name
              .slice(0, 2)
              .toUpperCase()}
          </div>
        )}

        <div
          className={
            styles.columns
          }
        >
          <div>
            <section
              className={
                styles.section
              }
            >
              <span
                className={
                  styles.eyebrow
                }
              >
                ABOUT
              </span>

              <h2>
                About this
                property
              </h2>

              <p>
                {listing.description ??
                  "Property details are available through RentPilot."}
              </p>
            </section>

            {listing.amenities
              .length > 0 ? (
              <section
                className={
                  styles.section
                }
              >
                <span
                  className={
                    styles.eyebrow
                  }
                >
                  AMENITIES
                </span>

                <h2>
                  Features
                </h2>

                <div
                  className={
                    styles.amenities
                  }
                >
                  {listing.amenities.map(
                    (
                      amenity,
                    ) => (
                      <span
                        key={
                          amenity
                        }
                      >
                        {amenity}
                      </span>
                    ),
                  )}
                </div>
              </section>
            ) : null}
          </div>

          <aside
            className={
              styles.notice
            }
          >
            <span
              className={
                styles.eyebrow
              }
            >
              AVAILABILITY
            </span>

            <h2>
              Looking to rent?
            </h2>

            <p>
              The units below are
              currently marked
              vacant by the property
              manager.
            </p>

            <Link
              href="/signup?role=tenant"
              className={
                styles.primaryButton
              }
            >
              Create tenant account
            </Link>

            <small>
              Landlord personal
              contact information is
              not published publicly.
            </small>
          </aside>
        </div>

        <section
          className={styles.units}
        >
          <div
            className={
              styles.sectionHead
            }
          >
            <div>
              <span
                className={
                  styles.eyebrow
                }
              >
                AVAILABLE UNITS
              </span>

              <h2>
                Choose a unit
              </h2>
            </div>

            <strong>
              {
                listing.units.length
              }{" "}
              available
            </strong>
          </div>

          <div
            className={
              styles.unitGrid
            }
          >
            {listing.units.map(
              (unit) => (
                <article
                  key={unit.id}
                  className={
                    styles.unitCard
                  }
                >
                  <div
                    className={
                      styles.unitHead
                    }
                  >
                    <div>
                      <small>
                        UNIT
                      </small>

                      <h3>
                        Unit{" "}
                        {
                          unit.unitNumber
                        }
                      </h3>
                    </div>

                    <span>
                      Available
                    </span>
                  </div>

                  <div
                    className={
                      styles.details
                    }
                  >
                    {unit.unitType ? (
                      <span>
                        {humanize(
                          unit.unitType,
                        )}
                      </span>
                    ) : null}

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
                        {
                          unit.floor
                        }
                      </span>
                    ) : null}
                  </div>

                  <div
                    className={
                      styles.price
                    }
                  >
                    <small>
                      MONTHLY RENT
                    </small>

                    <strong>
                      {money(
                        unit.monthlyRent,
                      )}
                    </strong>
                  </div>

                  {unit.securityDeposit >
                  0 ? (
                    <p>
                      Security deposit:{" "}
                      {money(
                        unit.securityDeposit,
                      )}
                    </p>
                  ) : null}
                </article>
              ),
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
