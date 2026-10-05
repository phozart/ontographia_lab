// lib/email.js
// SMTP email delivery via nodemailer, configured entirely by environment variables:
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_SECURE (true/false),
//   SMTP_USER, SMTP_PASS, EMAIL_FROM (required when SMTP_HOST is set).
// Credentials are never logged.

import nodemailer from 'nodemailer';

let transport = null;

/** True when an SMTP host and a sender address are both configured. */
export function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);
}

function getTransport() {
  if (!transport) {
    const config = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    };
    if (process.env.SMTP_USER) {
      config.auth = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
    }
    transport = nodemailer.createTransport(config);
  }
  return transport;
}

/** Send a message. Rejects if email is not configured or delivery fails. */
export async function sendMail({ to, subject, text, html }) {
  if (!isEmailConfigured()) {
    throw new Error('Email transport not configured (set SMTP_HOST and EMAIL_FROM)');
  }
  const message = { from: process.env.EMAIL_FROM, to, subject, text };
  if (html) message.html = html;
  return getTransport().sendMail(message);
}
