// lib/emailTemplates.js
// Plain-text + simple HTML message bodies.

const APP_NAME = 'Ontographia Lab';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function passwordResetEmail({ resetUrl, expiresInHours = 1 }) {
  const expiry = `${expiresInHours} ${expiresInHours === 1 ? 'hour' : 'hours'}`;
  const subject = `Reset your ${APP_NAME} password`;

  const text = [
    `We received a request to reset your ${APP_NAME} password.`,
    '',
    `Open this link to choose a new password (valid for ${expiry}):`,
    resetUrl,
    '',
    'If you did not request this, you can ignore this email. Your password will not change.',
  ].join('\n');

  const safeUrl = escapeHtml(resetUrl);
  const html = `<!doctype html>
<html><body style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.5">
<p>We received a request to reset your ${APP_NAME} password.</p>
<p><a href="${safeUrl}" style="display:inline-block;padding:10px 18px;background:#4FB3CE;color:#fff;text-decoration:none;border-radius:6px">Reset password</a></p>
<p>This link is valid for ${expiry}. If the button does not work, copy this address into your browser:<br>${safeUrl}</p>
<p>If you did not request this, you can ignore this email. Your password will not change.</p>
</body></html>`;

  return { subject, text, html };
}
