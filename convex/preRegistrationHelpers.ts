import { MutationCtx } from "./_generated/server";

/**
 * Converts an ArrayBuffer or Uint8Array to a lowercase hex string.
 */
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generates a cryptographically secure 32-byte registration link token (64 hex chars).
 */
export function generateRegistrationToken(): string {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  return bufferToHex(tokenBytes);
}

/**
 * Retrieves the global pre-registration salt, or initializes a CSPRNG salt if not present.
 */
export async function getOrCreatePreRegistrationSalt(ctx: MutationCtx): Promise<string> {
  const existing = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", "preRegistrationSalt"))
    .unique();

  if (existing && existing.description) {
    return existing.description;
  }

  const saltBytes = new Uint8Array(32);
  crypto.getRandomValues(saltBytes);
  const saltHex = bufferToHex(saltBytes);

  if (existing) {
    await ctx.db.patch("appSettings", existing._id, {
      description: saltHex,
    });
  } else {
    await ctx.db.insert("appSettings", {
      key: "preRegistrationSalt",
      value: true,
      description: saltHex,
    });
  }

  return saltHex;
}

/**
 * Computes a salted SHA-256 hash using the global pre-registration salt.
 */
export async function hashWithSalt(salt: string, rawValue: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${rawValue}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(hashBuffer);
}

/**
 * Normalizes phone numbers to standard format (e.g. 6281234567890).
 * Strips non-digits, converts leading '0' or '+62' or bare '8' to '628...'.
 */
export function normalizePhoneNumber(phone: string): string {
  let digits = phone.replace(/\D/g, "").trim();

  // If starts with "08", replace leading "0" with "62"
  if (digits.startsWith("08")) {
    digits = "62" + digits.slice(1);
  } else if (digits.startsWith("8")) {
    // If starts directly with "8" (e.g. 81234567890)
    digits = "62" + digits;
  } else if (digits.startsWith("62")) {
    // If starts with "6208...", remove the redundant '0'
    if (digits.startsWith("6208")) {
      digits = "62" + digits.slice(3);
    }
  }

  return digits;
}

/**
 * Validates strictly 10-digit NISN format.
 */
export function validateNisnFormat(nisn: string): boolean {
  return /^\d{10}$/.test(nisn);
}

/**
 * Validates 4-digit birth year format.
 */
export function validateBirthYearFormat(year: string): boolean {
  return /^\d{4}$/.test(year);
}
