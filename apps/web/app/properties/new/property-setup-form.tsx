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
} from "../../../lib/api";

import styles from "./property-setup.module.css";

const PROPERTY_TYPES = [
  ["apartment_building", "Apartment building"],
  ["house", "House"],
  ["duplex", "Duplex"],
  ["block_of_flats", "Block of flats"],
  ["commercial_property", "Commercial property"],
  ["office", "Office"],
  ["shop", "Shop"],
  ["warehouse", "Warehouse"],
  ["mixed_use", "Mixed use"],
  ["other", "Other"],
] as const;

type UnitDraft = {
  id: string;
  unitNumber: string;
  unitType: string;
  bedrooms: string;
  bathrooms: string;
  floor: string;
  monthlyRent: string;
  securityDeposit: string;
};

type PropertySetupResponse = {
  success: true;

  data: {
    propertyId: string;
    unitCount: number;
  };
};

function newUnit(
  number: number,
): UnitDraft {
  return {
    id:
      crypto.randomUUID(),

    unitNumber:
      `Unit ${number}`,

    unitType:
      "Apartment",

    bedrooms: "1",
    bathrooms: "1",
    floor: "",
    monthlyRent: "",
    securityDeposit: "",
  };
}

export default function PropertySetupForm() {
  const router = useRouter();

  const [name, setName] =
    useState("");

  const [address, setAddress] =
    useState("");

  const [city, setCity] =
    useState("");

  const [state, setState] =
    useState("Lagos");

  const [
    propertyType,
    setPropertyType,
  ] = useState(
    "apartment_building",
  );

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    amenitiesText,
    setAmenitiesText,
  ] = useState("");

  const [units, setUnits] =
    useState<UnitDraft[]>([
      newUnit(1),
    ]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  function addUnit() {
    setUnits((current) => [
      ...current,
      newUnit(
        current.length + 1,
      ),
    ]);
  }

  function removeUnit(
    id: string,
  ) {
    setUnits((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter(
        (unit) =>
          unit.id !== id,
      );
    });
  }

  function updateUnit(
    id: string,
    field: keyof UnitDraft,
    value: string,
  ) {
    setUnits((current) =>
      current.map((unit) =>
        unit.id === id
          ? {
              ...unit,
              [field]: value,
            }
          : unit,
      ),
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);

    const normalisedNumbers =
      units.map((unit) =>
        unit.unitNumber
          .trim()
          .toLowerCase(),
      );

    if (
      new Set(
        normalisedNumbers,
      ).size !==
      normalisedNumbers.length
    ) {
      setError(
        "Each unit must have a unique unit number.",
      );

      return;
    }

    if (
      units.some(
        (unit) =>
          !unit.unitNumber.trim() ||
          !unit.unitType.trim() ||
          unit.monthlyRent === "",
      )
    ) {
      setError(
        "Complete the required fields for every unit.",
      );

      return;
    }

    setLoading(true);

    try {
      const amenities =
        amenitiesText
          .split(",")
          .map((value) =>
            value.trim(),
          )
          .filter(Boolean);

      const response =
        await apiFetch<PropertySetupResponse>(
          "/properties/setup",
          {
            method: "POST",

            body: JSON.stringify({
              name,
              address,
              city:
                city ||
                undefined,

              state:
                state ||
                undefined,

              country:
                "Nigeria",

              propertyType,

              description:
                description ||
                undefined,

              amenities,

              units:
                units.map(
                  (unit) => ({
                    unitNumber:
                      unit.unitNumber,

                    unitType:
                      unit.unitType,

                    bedrooms:
                      Number(
                        unit.bedrooms ||
                          0,
                      ),

                    bathrooms:
                      Number(
                        unit.bathrooms ||
                          0,
                      ),

                    floor:
                      unit.floor ||
                      null,

                    monthlyRent:
                      Number(
                        unit.monthlyRent,
                      ),

                    securityDeposit:
                      Number(
                        unit.securityDeposit ||
                          0,
                      ),
                  }),
                ),
            }),
          },
        );

      router.replace(
        `/properties/${response.data.propertyId}`,
      );

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create property.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className={styles.page}
    >
      <header
        className={styles.header}
      >
        <Link
          href="/dashboard"
          className={styles.brand}
        >
          <span>R</span>
          RentPilot
        </Link>

        <Link
          href="/dashboard"
          className={styles.cancel}
        >
          Back to dashboard
        </Link>
      </header>

      <div
        className={styles.layout}
      >
        <aside
          className={styles.intro}
        >
          <p
            className={styles.eyebrow}
          >
            PROPERTY SETUP
          </p>

          <h1>
            Add your first property.
          </h1>

          <p>
            Add the property once,
            then create the real
            rentable units inside it.
          </p>

          <div
            className={styles.steps}
          >
            <div>
              <b>01</b>
              <span>
                Property details
              </span>
            </div>

            <div>
              <b>02</b>
              <span>
                Units & rent
              </span>
            </div>

            <div>
              <b>03</b>
              <span>
                Add tenants next
              </span>
            </div>
          </div>
        </aside>

        <form
          className={styles.form}
          onSubmit={handleSubmit}
        >
          <section
            className={styles.card}
          >
            <div
              className={
                styles.sectionTitle
              }
            >
              <div>
                <small>
                  PROPERTY
                </small>

                <h2>
                  Property details
                </h2>
              </div>

              <span>
                Required
              </span>
            </div>

            <div
              className={styles.grid}
            >
              <label
                className={
                  styles.full
                }
              >
                Property name

                <input
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="e.g. Lekki Court"
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label
                className={
                  styles.full
                }
              >
                Address

                <input
                  required
                  minLength={5}
                  maxLength={300}
                  placeholder="Street and area"
                  value={address}
                  onChange={(event) =>
                    setAddress(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                City

                <input
                  value={city}
                  placeholder="Lagos"
                  onChange={(event) =>
                    setCity(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                State

                <input
                  value={state}
                  onChange={(event) =>
                    setState(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label
                className={
                  styles.full
                }
              >
                Property type

                <select
                  value={propertyType}
                  onChange={(event) =>
                    setPropertyType(
                      event.target
                        .value,
                    )
                  }
                >
                  {PROPERTY_TYPES.map(
                    ([
                      value,
                      label,
                    ]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label
                className={
                  styles.full
                }
              >
                Description

                <textarea
                  rows={4}
                  maxLength={3000}
                  placeholder="Optional property notes"
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label
                className={
                  styles.full
                }
              >
                Amenities

                <input
                  placeholder="Parking, generator, security"
                  value={
                    amenitiesText
                  }
                  onChange={(event) =>
                    setAmenitiesText(
                      event.target
                        .value,
                    )
                  }
                />

                <small>
                  Separate amenities
                  with commas.
                </small>
              </label>
            </div>
          </section>

          <section
            className={styles.card}
          >
            <div
              className={
                styles.sectionTitle
              }
            >
              <div>
                <small>
                  RENTABLE UNITS
                </small>

                <h2>
                  Units
                </h2>

                <p>
                  Rent is tracked
                  against each unit.
                </p>
              </div>

              <button
                type="button"
                className={
                  styles.secondary
                }
                onClick={addUnit}
              >
                + Add unit
              </button>
            </div>

            <div
              className={
                styles.unitList
              }
            >
              {units.map(
                (unit, index) => (
                  <article
                    key={unit.id}
                    className={
                      styles.unit
                    }
                  >
                    <div
                      className={
                        styles.unitHead
                      }
                    >
                      <div>
                        <small>
                          UNIT{" "}
                          {index + 1}
                        </small>

                        <h3>
                          {unit.unitNumber ||
                            "Untitled unit"}
                        </h3>
                      </div>

                      {units.length >
                      1 ? (
                        <button
                          type="button"
                          className={
                            styles.remove
                          }
                          onClick={() =>
                            removeUnit(
                              unit.id,
                            )
                          }
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <div
                      className={
                        styles.grid
                      }
                    >
                      <label>
                        Unit number

                        <input
                          required
                          value={
                            unit.unitNumber
                          }
                          onChange={(
                            event,
                          ) =>
                            updateUnit(
                              unit.id,
                              "unitNumber",
                              event.target
                                .value,
                            )
                          }
                        />
                      </label>

                      <label>
                        Unit type

                        <input
                          required
                          placeholder="Apartment"
                          value={
                            unit.unitType
                          }
                          onChange={(
                            event,
                          ) =>
                            updateUnit(
                              unit.id,
                              "unitType",
                              event.target
                                .value,
                            )
                          }
                        />
                      </label>

                      <label>
                        Bedrooms

                        <input
                          required
                          type="number"
                          min="0"
                          max="50"
                          value={
                            unit.bedrooms
                          }
                          onChange={(
                            event,
                          ) =>
                            updateUnit(
                              unit.id,
                              "bedrooms",
                              event.target
                                .value,
                            )
                          }
                        />
                      </label>

                      <label>
                        Bathrooms

                        <input
                          required
                          type="number"
                          min="0"
                          max="50"
                          step="0.5"
                          value={
                            unit.bathrooms
                          }
                          onChange={(
                            event,
                          ) =>
                            updateUnit(
                              unit.id,
                              "bathrooms",
                              event.target
                                .value,
                            )
                          }
                        />
                      </label>

                      <label>
                        Floor

                        <input
                          placeholder="Ground floor"
                          value={
                            unit.floor
                          }
                          onChange={(
                            event,
                          ) =>
                            updateUnit(
                              unit.id,
                              "floor",
                              event.target
                                .value,
                            )
                          }
                        />
                      </label>

                      <label>
                        Monthly rent

                        <input
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="250000"
                          value={
                            unit.monthlyRent
                          }
                          onChange={(
                            event,
                          ) =>
                            updateUnit(
                              unit.id,
                              "monthlyRent",
                              event.target
                                .value,
                            )
                          }
                        />
                      </label>

                      <label
                        className={
                          styles.full
                        }
                      >
                        Security deposit

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={
                            unit.securityDeposit
                          }
                          onChange={(
                            event,
                          ) =>
                            updateUnit(
                              unit.id,
                              "securityDeposit",
                              event.target
                                .value,
                            )
                          }
                        />
                      </label>
                    </div>
                  </article>
                ),
              )}
            </div>
          </section>

          {error ? (
            <div
              role="alert"
              className={
                styles.error
              }
            >
              {error}
            </div>
          ) : null}

          <div
            className={styles.actions}
          >
            <Link
              href="/dashboard"
              className={
                styles.cancelButton
              }
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={loading}
              className={
                styles.primary
              }
            >
              {loading
                ? "Creating property..."
                : `Create property & ${units.length} ${
                    units.length ===
                    1
                      ? "unit"
                      : "units"
                  }`}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
