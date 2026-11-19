import nodemailer from "nodemailer";

import { env } from "../config/env";
import { AppError } from "../utils/app-error";

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined
    })
  : null;

export function assertMailAvailable() {
  if (!transporter && env.NODE_ENV === "production") throw new AppError(503, "Wysyłka e-maili jest chwilowo niedostępna. Spróbuj później.", "MAIL_UNAVAILABLE");
}

export async function sendMail(recipient: string, subject: string, text: string) {
  assertMailAvailable();
  if (!transporter) return false;
  try {
    await transporter.sendMail({ from: env.SMTP_FROM, to: recipient, subject, text });
    return true;
  } catch {
    throw new AppError(503, "Wysyłka e-maili jest chwilowo niedostępna. Spróbuj później.", "MAIL_UNAVAILABLE");
  }
}

export async function sendAccountActionEmail(
  recipient: string,
  kind: "password-reset" | "email-verification",
  token: string
) {
  const path = kind === "password-reset" ? "reset-password" : "verify-email";
  const link = `${env.APP_PUBLIC_URL.replace(/\/$/, "")}/${path}?token=${encodeURIComponent(token)}`;

  return sendMail(recipient,
    kind === "password-reset" ? "Reset hasła Pupply" : "Potwierdź e-mail Pupply",
      kind === "password-reset"
        ? `Aby ustawić nowe hasło, otwórz: ${link}`
        : `Aby potwierdzić adres e-mail, otwórz: ${link}`
  );
}
