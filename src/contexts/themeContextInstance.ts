import { createContext } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

export const STORAGE_KEY = "kasly-theme";

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);
