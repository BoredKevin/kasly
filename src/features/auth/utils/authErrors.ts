import { ConvexError } from "convex/values";

/**
 * Extracts a clean, user-facing error message from any authentication error.
 * Prevents raw server errors or Convex internal stack traces from leaking to the UI.
 */
export function formatAuthError(err: unknown): string {
  if (!err) {
    return "An unexpected error occurred. Please try again.";
  }

  // 1. ConvexError instance
  if (err instanceof ConvexError) {
    if (typeof err.data === "string" && err.data.trim()) {
      return err.data.trim();
    }
    const dataObj = err.data as Record<string, unknown> | null | undefined;
    if (dataObj && typeof dataObj.message === "string" && dataObj.message.trim()) {
      return dataObj.message.trim();
    }
  }

  // 2. Duck-typed ConvexError or object with data
  const candidate = err as { data?: unknown; message?: unknown };
  if (typeof candidate.data === "string" && candidate.data.trim()) {
    return candidate.data.trim();
  }
  const candidateDataObj = candidate.data as Record<string, unknown> | null | undefined;
  if (candidateDataObj && typeof candidateDataObj.message === "string" && candidateDataObj.message.trim()) {
    return candidateDataObj.message.trim();
  }

  // 3. Inspect message
  const rawMessage = typeof candidate.message === "string" ? candidate.message : "";

  // If the raw error mentions low-level credential codes
  if (
    /invalidsecret/i.test(rawMessage) ||
    /invalidaccountid/i.test(rawMessage) ||
    /invalid credentials/i.test(rawMessage) ||
    /invalid email or password/i.test(rawMessage)
  ) {
    return "Invalid email or password";
  }

  if (/toomanyfailedattempts/i.test(rawMessage)) {
    return "Too many failed login attempts. Please try again later.";
  }

  // Extract from ConvexError trace format: e.g. "[CONVEX A(auth:signIn)] ConvexError: <message>\n"
  const convexErrorMatch = rawMessage.match(/ConvexError:\s*"?([^"\n\r]+)"?/);
  if (convexErrorMatch && convexErrorMatch[1]) {
    const extracted = convexErrorMatch[1].trim();
    if (extracted && extracted !== "Server Error") {
      return extracted;
    }
  }

  // If generic unhandled server error occurs during sign in
  if (/server error/i.test(rawMessage)) {
    return "Invalid email or password";
  }

  // Clean any remaining [CONVEX ...] or Error: prefixes
  const cleanMessage = rawMessage
    .replace(/^\[CONVEX[^\]]*\]\s*/, "")
    .replace(/^Error:\s*/, "")
    .split("\n")[0]
    .trim();

  return cleanMessage || "Invalid email or password";
}
