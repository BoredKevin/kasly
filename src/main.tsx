import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "@boredkevin/ui";
import "./index.css";
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
    <ConvexAuthProvider client={convex}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ConvexAuthProvider>
  </StrictMode>,
);

if (typeof window !== "undefined" && window.__updateAppProgress) {
  window.__updateAppProgress(100, "Ready");
}
