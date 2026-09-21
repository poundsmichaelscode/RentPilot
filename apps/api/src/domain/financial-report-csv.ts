export type FinancialReportExport = {
  organisationId: string;

  propertyId:
    | string
    | null;

  from: string;
  to: string;

  currency: string;

  summary: {
    rentCollected:
      | number
      | string;

    paidExpenses:
      | number
      | string;

    pendingExpenses:
      | number
      | string;

    netCashFlow:
      | number
      | string;

    organisationWidePaidExpenses:
      | number
      | string;

    organisationWidePendingExpenses:
      | number
      | string;
  };

  properties: Array<{
    propertyId: string;
    propertyName: string;

    rentCollected:
      | number
      | string;

    paidExpenses:
      | number
      | string;

    pendingExpenses:
      | number
      | string;

    netCashFlow:
      | number
      | string;
  }>;

  foreignCurrencyExpenses:
    Array<{
      currency: string;

      paidExpenses:
        | number
        | string;

      pendingExpenses:
        | number
        | string;
    }>;

  basis: {
    accountingBasis: string;
  };
};

function csvCell(
  value: unknown,
) {
  const text =
    value === null ||
    value === undefined
      ? ""
      : String(value);

  if (
    /[",\r\n]/.test(text)
  ) {
    return `"${text.replaceAll(
      '"',
      '""',
    )}"`;
  }

  return text;
}

function row(
  ...values: unknown[]
) {
  return values
    .map(csvCell)
    .join(",");
}

export function financialReportToCsv(
  report:
    FinancialReportExport,
) {
  const lines: string[] =
    [];

  lines.push(
    row(
      "RENTpilot Financial Report",
    ),
  );

  lines.push(
    row(
      "From",
      report.from,
    ),
  );

  lines.push(
    row(
      "To",
      report.to,
    ),
  );

  lines.push(
    row(
      "Currency",
      report.currency,
    ),
  );

  lines.push(
    row(
      "Accounting Basis",
      report.basis
        .accountingBasis,
    ),
  );

  lines.push("");

  lines.push(
    row(
      "Summary",
    ),
  );

  lines.push(
    row(
      "Metric",
      "Amount",
      "Currency",
    ),
  );

  lines.push(
    row(
      "Rent Collected",
      report.summary
        .rentCollected,
      report.currency,
    ),
  );

  lines.push(
    row(
      "Paid Expenses",
      report.summary
        .paidExpenses,
      report.currency,
    ),
  );

  lines.push(
    row(
      "Pending Expenses",
      report.summary
        .pendingExpenses,
      report.currency,
    ),
  );

  lines.push(
    row(
      "Net Cash Flow",
      report.summary
        .netCashFlow,
      report.currency,
    ),
  );

  lines.push(
    row(
      "Organisation-wide Paid Expenses",
      report.summary
        .organisationWidePaidExpenses,
      report.currency,
    ),
  );

  lines.push(
    row(
      "Organisation-wide Pending Expenses",
      report.summary
        .organisationWidePendingExpenses,
      report.currency,
    ),
  );

  lines.push("");

  lines.push(
    row(
      "Property Performance",
    ),
  );

  lines.push(
    row(
      "Property",
      "Rent Collected",
      "Paid Expenses",
      "Pending Expenses",
      "Net Cash Flow",
      "Currency",
    ),
  );

  for (
    const property
    of report.properties
  ) {
    lines.push(
      row(
        property.propertyName,

        property.rentCollected,

        property.paidExpenses,

        property.pendingExpenses,

        property.netCashFlow,

        report.currency,
      ),
    );
  }

  if (
    report
      .foreignCurrencyExpenses
      .length > 0
  ) {
    lines.push("");

    lines.push(
      row(
        "Other Currency Expenses",
      ),
    );

    lines.push(
      row(
        "Currency",
        "Paid Expenses",
        "Pending Expenses",
      ),
    );

    for (
      const item
      of report
        .foreignCurrencyExpenses
    ) {
      lines.push(
        row(
          item.currency,

          item.paidExpenses,

          item.pendingExpenses,
        ),
      );
    }
  }

  return (
    lines.join("\r\n") +
    "\r\n"
  );
}
