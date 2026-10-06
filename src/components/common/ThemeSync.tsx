import { useEffect } from "react";
import { useTheme } from "../../contexts";

/**
 * ThemeSync is a lightweight synchronization component that ensures runtime
 * theme states, meta theme-color tags for mobile browser headers, and HTML root
 * styling remain in sync with the active theme mode.
 */
export function ThemeSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (typeof document === "undefined") return;

    // Update meta theme-color tag for mobile status bar & browser toolbar chrome
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      resolvedTheme === "dark" ? "#0a0a0c" : "#ffffff",
    );
  }, [resolvedTheme]);

  return null;
}

export default ThemeSync;
