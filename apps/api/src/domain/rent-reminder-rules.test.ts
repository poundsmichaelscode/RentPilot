import assert from "node:assert/strict";
import {
  describe,
  it,
} from "node:test";

import {
  calculateOutstanding,
  reminderTypeForDate,
  shouldGenerateRentReminder,
} from "./rent-reminder-rules.js";

describe(
  "rent financial rules",
  () => {
    it(
      "calculates outstanding as expected minus waived minus payments",
      () => {
        assert.equal(
          calculateOutstanding(
            800_000,
            50_000,
            250_000,
          ),
          500_000,
        );
      },
    );

    it(
      "never returns a negative outstanding balance",
      () => {
        assert.equal(
          calculateOutstanding(
            100_000,
            0,
            150_000,
          ),
          0,
        );
      },
    );

    it(
      "accounts for waived rent before determining balance",
      () => {
        assert.equal(
          calculateOutstanding(
            500_000,
            100_000,
            300_000,
          ),
          100_000,
        );
      },
    );
  },
);

describe(
  "rent reminder classification",
  () => {
    const today =
      "2026-09-15";

    it(
      "classifies three days before due date as due soon",
      () => {
        assert.equal(
          reminderTypeForDate(
            today,
            "2026-09-18",
          ),
          "RENT_DUE_SOON",
        );
      },
    );

    it(
      "classifies the due date as due today",
      () => {
        assert.equal(
          reminderTypeForDate(
            today,
            "2026-09-15",
          ),
          "RENT_DUE_TODAY",
        );
      },
    );

    it(
      "classifies one day past due as overdue",
      () => {
        assert.equal(
          reminderTypeForDate(
            today,
            "2026-09-14",
          ),
          "RENT_OVERDUE",
        );
      },
    );

    it(
      "does not produce a reminder outside the configured reminder window",
      () => {
        assert.equal(
          reminderTypeForDate(
            today,
            "2026-09-20",
          ),
          null,
        );
      },
    );
  },
);

describe(
  "rent reminder eligibility",
  () => {
    it(
      "suppresses reminders when a charge is fully paid",
      () => {
        const result =
          shouldGenerateRentReminder({
            today:
              "2026-09-15",

            dueDate:
              "2026-09-15",

            expectedAmount:
              800_000,

            waivedAmount:
              0,

            paidAmount:
              800_000,
          });

        assert.equal(
          result.outstanding,
          0,
        );

        assert.equal(
          result.type,
          "RENT_DUE_TODAY",
        );

        assert.equal(
          result.eligible,
          false,
        );
      },
    );

    it(
      "allows a due-today reminder when money is still outstanding",
      () => {
        const result =
          shouldGenerateRentReminder({
            today:
              "2026-09-15",

            dueDate:
              "2026-09-15",

            expectedAmount:
              800_000,

            waivedAmount:
              0,

            paidAmount:
              300_000,
          });

        assert.equal(
          result.outstanding,
          500_000,
        );

        assert.equal(
          result.eligible,
          true,
        );
      },
    );
  },
);
