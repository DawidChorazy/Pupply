import nodemailer from "nodemailer";

import { env } from "../config/env";

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined
    })
  : null;

export async function sendAccountActionEmail(
  recipient: string,
  kind: "password-reset" | "email-verification",
  token: string
) {
  const path = kind === "password-reset" ? "reset-password" : "verify-email";
  const link = `${env.APP_PUBLIC_URL.replace(/\/$/, "")}/${path}?token=${encodeURIComponent(token)}`;

  if (!transporter) {
    return false;
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: recipient,
    subject: kind === "password-reset" ? "Reset hasła Pupply" : "Potwierdź e-mail Pupply",
    text:
      kind === "password-reset"
        ? `Aby ustawić nowe hasło, otwórz: ${link}`
        : `Aby potwierdzić adres e-mail, otwórz: ${link}`
  });

  return true;
}
