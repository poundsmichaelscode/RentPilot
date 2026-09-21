export type RentReminderType =
  | "RENT_DUE_SOON"
  | "RENT_DUE_TODAY"
  | "RENT_OVERDUE";

const DAY_MS =
  24 * 60 * 60 * 1000;

function dateOnlyToUtc(
  value: string,
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  if (!match) {
    throw new Error(
      `Invalid date-only value: ${value}`,
    );
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  return Date.UTC(
    year,
    month - 1,
    day,
  );
}

export function calculateOutstanding(
  expectedAmount: number,
  waivedAmount: number,
  paidAmount: number,
) {
  for (const value of [
    expectedAmount,
    waivedAmount,
    paidAmount,
  ]) {
    if (
      !Number.isFinite(value)
    ) {
      throw new Error(
        "Rent amounts must be finite numbers.",
      );
    }
  }

  return Math.max(
    expectedAmount -
      waivedAmount -
      paidAmount,
    0,
  );
}

export function reminderTypeForDate(
  today: string,
  dueDate: string,
): RentReminderType | null {
  const todayUtc =
    dateOnlyToUtc(today);

  const dueUtc =
    dateOnlyToUtc(dueDate);

  const daysUntilDue =
    Math.round(
      (dueUtc - todayUtc) /
        DAY_MS,
    );

  if (daysUntilDue === 3) {
    return "RENT_DUE_SOON";
  }

  if (daysUntilDue === 0) {
    return "RENT_DUE_TODAY";
  }

  if (daysUntilDue === -1) {
    return "RENT_OVERDUE";
  }

  return null;
}

export function shouldGenerateRentReminder({
  today,
  dueDate,
  expectedAmount,
  waivedAmount,
  paidAmount,
}: {
  today: string;
  dueDate: string;
  expectedAmount: number;
  waivedAmount: number;
  paidAmount: number;
}) {
  const outstanding =
    calculateOutstanding(
      expectedAmount,
      waivedAmount,
      paidAmount,
    );

  const type =
    reminderTypeForDate(
      today,
      dueDate,
    );

  return {
    eligible:
      outstanding > 0 &&
      type !== null,

    outstanding,

    type,
  };
}
