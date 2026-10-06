import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider as BoredKevinThemeProvider } from "@boredkevin/ui";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ThemeSync } from "./components/common/ThemeSync";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "./index.css";
import "./i18n";
import App from "./App.tsx";

declare global {
  interface Window {
    __updateAppProgress?: (percent?: number, text?: string) => void;
  }
}

if (typeof window !== "undefined" && window.__updateAppProgress) {
  window.__updateAppProgress(70, "Connecting to backend...");
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

if (typeof window !== "undefined" && window.__updateAppProgress) {
  window.__updateAppProgress(90, "Loading workspace...");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider
      client={convex}
      shouldHandleCode={() =>
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/reset-password")
      }
    >
      <BoredKevinThemeProvider>
        <ThemeProvider>
          <ThemeSync />
          <App />
        </ThemeProvider>
      </BoredKevinThemeProvider>
    </ConvexAuthProvider>
  </StrictMode>,
);

if (typeof window !== "undefined" && window.__updateAppProgress) {
  window.__updateAppProgress(100, "Ready");
}
