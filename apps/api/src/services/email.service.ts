import nodemailer from "nodemailer";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendEmailResult = {
  provider: string;
  messageId: string;
};

function getMode() {
  return (
    process.env
      .EMAIL_DELIVERY_MODE ??
    "console"
  ).toLowerCase();
}

function escapeHtml(
  value: string,
) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const mode = getMode();

  if (mode === "console") {
    const messageId =
      `console-${crypto.randomUUID()}`;

    console.log(
      "\n========== RENTPILOT EMAIL ==========",
    );

    console.log({
      to: input.to,
      subject: input.subject,
      text: input.text,
      messageId,
    });

    console.log(
      "=====================================\n",
    );

    return {
      provider: "console",
      messageId,
    };
  }

  if (mode !== "smtp") {
    throw new Error(
      `Unsupported EMAIL_DELIVERY_MODE: ${mode}`,
    );
  }

  const host =
    process.env.SMTP_HOST;

  const port =
    Number(
      process.env.SMTP_PORT ??
        587,
    );

  const secure =
    process.env.SMTP_SECURE ===
    "true";

  const user =
    process.env.SMTP_USER;

  const password =
    process.env.SMTP_PASSWORD;

  const fromName =
    process.env.EMAIL_FROM_NAME ??
    "RENTpilot";

  const fromAddress =
    process.env
      .EMAIL_FROM_ADDRESS;

  if (
    !host ||
    !user ||
    !password ||
    !fromAddress
  ) {
    throw new Error(
      "SMTP configuration is incomplete.",
    );
  }

  const transporter =
    nodemailer.createTransport({
      host,
      port,
      secure,

      auth: {
        user,
        pass: password,
      },
    });

  const result =
    await transporter.sendMail({
      from:
        `"${fromName}" <${fromAddress}>`,

      to: input.to,

      subject:
        input.subject,

      text:
        input.text,

      html:
        input.html ??
        `<p>${escapeHtml(
          input.text,
        )}</p>`,
    });

  return {
    provider: "smtp",
    messageId:
      result.messageId,
  };
}
