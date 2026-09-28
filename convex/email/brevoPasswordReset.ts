import { Email } from "@convex-dev/auth/providers/Email";

declare const process: { env: Record<string, string | undefined> };

function generateSecureToken(length = 32): string {
  const chars =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues)
    .map((val) => chars[val % chars.length])
    .join("");
}

export const BrevoPasswordReset = Email({
  id: "brevo-password-reset",
  maxAge: 15 * 60, // 15 minutes
  async generateVerificationToken() {
    return generateSecureToken(32);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL || "noreply@kasly.app";
    const senderName = process.env.BREVO_SENDER_NAME || "Kasly Platform";
    const siteUrl = (process.env.SITE_URL || "http://localhost:5173").replace(
      /\/$/,
      "",
    );

    const resetUrl = `${siteUrl}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    // In local development or if no API key is set yet, log to console
    if (!apiKey) {
      console.warn(
        `\n======================================================\n` +
        `[DEV AUTH] Brevo API Key not configured.\n` +
        `Password reset link for ${email}:\n` +
        `${resetUrl}\n` +
        `======================================================\n`,
      );
      return;
    }

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0c0d0e; color: #f4f4f5; padding: 40px 20px; text-align: center;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #141517; border: 1px solid #27272a; padding: 36px 32px; border-radius: 6px; text-align: left;">
          <div style="margin-bottom: 24px;">
            <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600; letter-spacing: -0.02em;">Kasly Platform</h2>
            <p style="margin: 4px 0 0 0; color: #a1a1aa; font-size: 13px;">Security & Account Management</p>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #d4d4d8; margin-bottom: 24px;">
            We received a request to reset your password. Click the button below to choose a new password. This reset link is valid for 15 minutes.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" target="_blank" style="display: inline-block; background-color: #22c55e; color: #000000; font-weight: 600; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 4px; letter-spacing: 0.02em;">
              Reset Your Password
            </a>
          </div>
          <p style="font-size: 12px; line-height: 1.5; color: #71717a; margin-top: 24px; margin-bottom: 8px;">
            If the button above does not work, copy and paste this link into your browser:
          </p>
          <p style="font-size: 11px; word-break: break-all; color: #a1a1aa; background-color: #18181b; padding: 10px; border-radius: 4px; border: 1px solid #27272a; margin-bottom: 24px;">
            <a href="${resetUrl}" style="color: #22c55e; text-decoration: underline;">${resetUrl}</a>
          </p>
          <p style="font-size: 12px; line-height: 1.5; color: #71717a; margin-bottom: 16px;">
            If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>
          <hr style="border: 0; border-top: 1px solid #27272a; margin: 24px 0;" />
          <p style="font-size: 11px; color: #52525b; margin: 0; text-align: center;">
            Kasly — Precision Treasury & Organization Platform
          </p>
        </div>
      </div>
    `;

    const textContent =
      `Kasly Platform - Password Reset\n\n` +
      `We received a request to reset your password. Open the link below to set a new password:\n\n` +
      `${resetUrl}\n\n` +
      `This link will expire in 15 minutes.\n\n` +
      `If you did not request a password reset, you can safely ignore this email.`;

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [{ email }],
        subject: "Reset your Kasly password",
        htmlContent,
        textContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Brevo Error]", response.status, errorText);
      throw new Error(
        `Failed to dispatch email via Brevo: ${response.statusText}`,
      );
    }
  },
});
