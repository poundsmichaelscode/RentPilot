import "./config/env.js";

import {
  notificationWorker,
} from "./workers/notification.worker.js";

import {
  runRentReminderCycle,
} from "./services/rent-reminder.service.js";

const scanInterval =
  Math.max(
    Number(
      process.env
        .RENT_REMINDER_SCAN_INTERVAL_MS ??
        900000,
    ),
    60000,
  );

let timer:
  NodeJS.Timeout | null =
  null;

let reminderScanRunning =
  false;

async function scanRentReminders() {
  if (
    reminderScanRunning
  ) {
    return;
  }

  reminderScanRunning =
    true;

  try {
    const result =
      await runRentReminderCycle();

    console.log(
      "Rent reminder scan complete.",
      result,
    );
  } catch (error) {
    console.error(
      "Rent reminder scan failed:",
      error,
    );
  } finally {
    reminderScanRunning =
      false;
  }
}

async function start() {
  console.log(
    "RENTpilot background worker starting...",
  );

  await scanRentReminders();

  timer =
    setInterval(
      () => {
        void scanRentReminders();
      },
      scanInterval,
    );
}

async function shutdown(
  signal: string,
) {
  console.log(
    `${signal} received. Closing worker...`,
  );

  if (timer) {
    clearInterval(timer);
  }

  await notificationWorker.close();

  process.exit(0);
}

process.on(
  "SIGINT",
  () => {
    void shutdown("SIGINT");
  },
);

process.on(
  "SIGTERM",
  () => {
    void shutdown("SIGTERM");
  },
);

void start();
