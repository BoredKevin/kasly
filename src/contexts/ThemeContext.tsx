import {
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useTheme as useBoredKevinTheme } from "@boredkevin/ui";
import {
  ThemeContext,
  STORAGE_KEY,
  type ThemeMode,
  type ResolvedTheme,
} from "./themeContextInstance";

function getSystemPreference(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // LocalStorage unavailable
  }
  return "system";
}

function applyThemeToDOM(resolvedTheme: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = resolvedTheme === "dark";

  if (isDark) {
    root.classList.add("dark");
    root.classList.remove("light");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
    root.style.colorScheme = "light";
  }
}

/**
 * Hook to safely read and set boredkevin UI's internal theme state if the provider is present.
 */
function useBoredKevinThemeBridge(resolvedTheme: ResolvedTheme) {
  let boredkevinTheme: ReturnType<typeof useBoredKevinTheme> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    boredkevinTheme = useBoredKevinTheme();
  } catch {
    boredkevinTheme = null;
  }

  useEffect(() => {
    if (!boredkevinTheme) return;
    const shouldBeDark = resolvedTheme === "dark";
    if (boredkevinTheme.isDark !== shouldBeDark) {
      boredkevinTheme.setIsDark(shouldBeDark);
    }
  }, [resolvedTheme, boredkevinTheme]);
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeMode;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = getStoredTheme();
    return stored || defaultTheme;
  });

  const [systemPreference, setSystemPreference] = useState<ResolvedTheme>(
    getSystemPreference,
  );

  const resolvedTheme: ResolvedTheme =
    theme === "system" ? systemPreference : theme;
  const isDark = resolvedTheme === "dark";

  // Bridge to boredkevin-ui ThemeProvider if mounted above us
  useBoredKevinThemeBridge(resolvedTheme);

  // Apply theme to DOM on state change
  useEffect(() => {
    applyThemeToDOM(resolvedTheme);
  }, [resolvedTheme]);

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Listen for storage events (syncing across browser tabs)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        if (
          e.newValue === "light" ||
          e.newValue === "dark" ||
          e.newValue === "system"
        ) {
          setThemeState(e.newValue);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // Storage quota or privacy mode error
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const currentResolved =
        current === "system" ? getSystemPreference() : current;
      const next: ThemeMode = currentResolved === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignored
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        isDark,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
