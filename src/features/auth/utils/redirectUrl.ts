/**
 * Safely parses and sanitizes redirect destination URLs from query strings.
 * Prevents open redirect attacks, protocol-relative exploits, and self-redirect loops to /login.
 */
export function getSafeRedirectUrl(search: string, fallback = "/treasury"): string {
  try {
    const params = new URLSearchParams(search);
    const target = params.get("redirectTo") || params.get("redirect");
    if (!target) return fallback;

    // Disallow external URLs (must start with '/'), protocol-relative '//', and self-redirects to '/login'
    if (
      !target.startsWith("/") ||
      target.startsWith("//") ||
      target.startsWith("/login") ||
      target.includes("javascript:") ||
      target.includes("data:")
    ) {
      return fallback;
    }

    // Root path '/' defaults to workspace home '/treasury' for logged-in users
    if (target === "/") {
      return fallback;
    }

    return target;
  } catch {
    return fallback;
  }
}
