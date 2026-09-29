import { ConvexError } from "convex/values";

/**
 * Extracts a clean, user-facing error message from any authentication error.
 * Prevents raw server errors or Convex internal stack traces from leaking to the UI.
 */
export function formatAuthError(err: unknown): string {
  if (!err) {
    return "An unexpected error occurred. Please try again.";
  }

  const sanitize = (msg: string): string => {
    const trimmed = msg.trim();
    if (
      /is not iterable/i.test(trimmed) ||
      /cannot read propert/i.test(trimmed) ||
      /typeerror/i.test(trimmed)
    ) {
      return "Unable to complete request due to a server configuration issue. Please contact support or try again.";
    }
    if (/missing environment variable/i.test(trimmed)) {
      return "Authentication keys are not configured on this server.";
    }
    return trimmed;
  };

  // 1. ConvexError instance
  if (err instanceof ConvexError) {
    if (typeof err.data === "string" && err.data.trim()) {
      return sanitize(err.data);
    }
    const dataObj = err.data as Record<string, unknown> | null | undefined;
    if (dataObj && typeof dataObj.message === "string" && dataObj.message.trim()) {
      return sanitize(dataObj.message);
    }
  }

  // 2. Duck-typed ConvexError or object with data
  const candidate = err as { data?: unknown; message?: unknown };
  if (typeof candidate.data === "string" && candidate.data.trim()) {
    return sanitize(candidate.data);
  }
  const candidateDataObj = candidate.data as Record<string, unknown> | null | undefined;
  if (candidateDataObj && typeof candidateDataObj.message === "string" && candidateDataObj.message.trim()) {
    return sanitize(candidateDataObj.message);
  }

  // 3. Inspect message
  const rawMessage = typeof candidate.message === "string" ? candidate.message : "";

  // If the raw error mentions verification codes
  if (
    /invalid code/i.test(rawMessage) ||
    /could not verify code/i.test(rawMessage) ||
    /expired verification code/i.test(rawMessage)
  ) {
    return "Invalid or expired verification code.";
  }

  if (/missing `newpassword`/i.test(rawMessage)) {
    return "New password is required.";
  }

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
    return "Too many failed attempts. Please try again later.";
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
