import fs from "fs/promises";
import nodemailer from "nodemailer";
import path from "path";

const EMAIL_OUTBOX_PATH = path.join(process.cwd(), "tmp", "email-outbox.log");

function readSmtpPort() {
  const port = Number(process.env.SMTP_PORT || 2525);
  return Number.isFinite(port) ? port : 2525;
}

function getSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASS must be configured for Mailtrap email.");
  }

  const port = readSmtpPort();
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  text: string;
}) {
  const provider = process.env.EMAIL_PROVIDER || "mock";

  if (provider === "mailtrap") {
    const transporter = getSmtpTransport();
    const from = process.env.EMAIL_FROM || "StudyFlow <notifications@studyflow.local>";
    const info = await transporter.sendMail({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text,
    });

    return { ok: true, provider, messageId: info.messageId };
  }

  if (provider !== "mock") {
    throw new Error(`Unsupported EMAIL_PROVIDER "${provider}". Use EMAIL_PROVIDER=mock or EMAIL_PROVIDER=mailtrap.`);
  }

  await fs.mkdir(path.dirname(EMAIL_OUTBOX_PATH), { recursive: true });
  await fs.appendFile(
    EMAIL_OUTBOX_PATH,
    [
      `Date: ${new Date().toISOString()}`,
      `To: ${args.to}`,
      `Subject: ${args.subject}`,
      "",
      args.text,
      "",
      "----",
      "",
    ].join("\n"),
    "utf8"
  );

  return { ok: true, provider, outboxPath: EMAIL_OUTBOX_PATH };
}
