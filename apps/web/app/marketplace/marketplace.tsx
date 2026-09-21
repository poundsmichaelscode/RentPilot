"use client";

import Link from "next/link";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import styles from "./marketplace.module.css";

type Listing = {
  id: string;
  name: string;
  propertyType: string | null;
  address: string;
  city: string | null;
  state: string | null;
  country: string;
  description: string | null;
  amenities: string[];
  images: string[];
  availableUnits: number;
  rentFrom: number | null;
  rentTo: number | null;
  bedrooms: number[];
  createdAt: string;
};

type MarketplaceResponse = {
  success: true;

  data: Listing[];

  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

function money(
  value: number | null,
) {
  if (value === null) {
    return "Contact for price";
  }

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
  value: string | null,
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

export default function Marketplace() {
  const [
    listings,
    setListings,
  ] = useState<Listing[]>([]);

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

  const [
    q,
    setQ,
  ] = useState("");

  const [
    propertyType,
    setPropertyType,
  ] = useState("");

  const [
    bedrooms,
    setBedrooms,
  ] = useState("");

  const [
    total,
    setTotal,
  ] = useState(0);

  async function load(
    search = "",
    type = "",
    beds = "",
  ) {
    try {
      setLoading(true);
      setError(null);

      const params =
        new URLSearchParams();

      if (search.trim()) {
        params.set(
          "q",
          search.trim(),
        );
      }

      if (type) {
        params.set(
          "propertyType",
          type,
        );
      }

      if (beds) {
        params.set(
          "bedrooms",
          beds,
        );
      }

      params.set(
        "pageSize",
        "24",
      );

      const response =
        await fetch(
          `/api/marketplace?${params.toString()}`,
          {
            cache: "no-store",
          },
        );

      if (!response.ok) {
        throw new Error(
          "Unable to load marketplace listings.",
        );
      }

      const payload =
        (await response.json()) as
          MarketplaceResponse;

      setListings(
        payload.data,
      );

      setTotal(
        payload.pagination.total,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load marketplace.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    void load(
      q,
      propertyType,
      bedrooms,
    );
  }

  function reset() {
    setQ("");
    setPropertyType("");
    setBedrooms("");

    void load();
  }

  return (
    <main
      className={styles.page}
    >
      <nav
        className={styles.nav}
      >
        <Link
          href="/"
          className={styles.brand}
        >
          <span>R</span>
          RentPilot
        </Link>

        <div
          className={
            styles.navActions
          }
        >
          <Link href="/login">
            Sign in
          </Link>

          <Link
            href="/signup"
            className={
              styles.primaryButton
            }
          >
            List a property
          </Link>
        </div>
      </nav>

      <section
        className={styles.hero}
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            RENTPILOT MARKETPLACE
          </span>

          <h1>
            Find your next rental.
          </h1>

          <p>
            Browse verified availability
            from properties managed on
            RentPilot.
          </p>
        </div>
      </section>

      <section
        className={styles.content}
      >
        <form
          className={
            styles.filters
          }
          onSubmit={submit}
        >
          <label>
            Search location

            <input
              value={q}
              onChange={(
                event,
              ) =>
                setQ(
                  event.target.value,
                )
              }
              placeholder="Yaba, Lekki, Ikeja..."
            />
          </label>

          <label>
            Property type

            <select
              value={
                propertyType
              }
              onChange={(
                event,
              ) =>
                setPropertyType(
                  event.target.value,
                )
              }
            >
              <option value="">
                All types
              </option>

              <option value="apartment_building">
                Apartment building
              </option>

              <option value="house">
                House
              </option>

              <option value="duplex">
                Duplex
              </option>

              <option value="block_of_flats">
                Block of flats
              </option>

              <option value="commercial_property">
                Commercial
              </option>

              <option value="office">
                Office
              </option>

              <option value="shop">
                Shop
              </option>

              <option value="warehouse">
                Warehouse
              </option>

              <option value="mixed_use">
                Mixed use
              </option>

              <option value="other">
                Other
              </option>
            </select>
          </label>

          <label>
            Bedrooms

            <select
              value={bedrooms}
              onChange={(
                event,
              ) =>
                setBedrooms(
                  event.target.value,
                )
              }
            >
              <option value="">
                Any
              </option>

              <option value="0">
                Studio
              </option>

              <option value="1">
                1 bedroom
              </option>

              <option value="2">
                2 bedrooms
              </option>

              <option value="3">
                3 bedrooms
              </option>

              <option value="4">
                4 bedrooms
              </option>

              <option value="5">
                5 bedrooms
              </option>
            </select>
          </label>

          <button
            type="submit"
            className={
              styles.primaryButton
            }
          >
            Search
          </button>

          <button
            type="button"
            className={
              styles.secondaryButton
            }
            onClick={reset}
          >
            Reset
          </button>
        </form>

        <div
          className={
            styles.resultHead
          }
        >
          <div>
            <span>
              AVAILABLE HOMES
            </span>

            <h2>
              Properties for rent
            </h2>
          </div>

          <p>
            {total}{" "}
            {total === 1
              ? "listing"
              : "listings"}
          </p>
        </div>

        {error ? (
          <div
            className={
              styles.error
            }
          >
            {error}
          </div>
        ) : loading ? (
          <div
            className={
              styles.empty
            }
          >
            Loading available
            properties…
          </div>
        ) : listings.length === 0 ? (
          <div
            className={
              styles.empty
            }
          >
            <h3>
              No properties found
            </h3>

            <p>
              Try changing your
              search filters or
              check back later.
            </p>
          </div>
        ) : (
          <div
            className={
              styles.grid
            }
          >
            {listings.map(
              (listing) => {
                const location =
                  [
                    listing.city,
                    listing.state,
                    listing.country,
                  ]
                    .filter(Boolean)
                    .join(", ");

                return (
                  <article
                    key={
                      listing.id
                    }
                    className={
                      styles.card
                    }
                  >
                    <div
                      className={
                        styles.image
                      }
                    >
                      {listing.images[0] ? (
                        <img
                          src={
                            listing.images[0]
                          }
                          alt={
                            listing.name
                          }
                        />
                      ) : (
                        <div
                          className={
                            styles.placeholder
                          }
                        >
                          {listing.name
                            .slice(
                              0,
                              2,
                            )
                            .toUpperCase()}
                        </div>
                      )}

                      <span>
                        {
                          listing.availableUnits
                        }{" "}
                        {listing.availableUnits ===
                        1
                          ? "unit"
                          : "units"}{" "}
                        available
                      </span>
                    </div>

                    <div
                      className={
                        styles.cardBody
                      }
                    >
                      <small>
                        {humanize(
                          listing.propertyType,
                        )}
                      </small>

                      <h3>
                        {
                          listing.name
                        }
                      </h3>

                      <p
                        className={
                          styles.location
                        }
                      >
                        {location ||
                          listing.address}
                      </p>

                      <div
                        className={
                          styles.features
                        }
                      >
                        {listing.bedrooms
                          .slice(0, 4)
                          .map(
                            (
                              bedroom,
                            ) => (
                              <span
                                key={
                                  bedroom
                                }
                              >
                                {bedroom ===
                                0
                                  ? "Studio"
                                  : `${bedroom} bed`}
                              </span>
                            ),
                          )}
                      </div>

                      <div
                        className={
                          styles.cardFoot
                        }
                      >
                        <div>
                          <small>
                            FROM
                          </small>

                          <strong>
                            {money(
                              listing.rentFrom,
                            )}
                          </strong>

                          {listing.rentFrom !==
                          null ? (
                            <span>
                              / month
                            </span>
                          ) : null}
                        </div>

                        <Link
                          href={`/marketplace/${listing.id}`}
                        >
                          View property →
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>
    </main>
  );
}
