import { useContext } from "react";
import { ThemeContext, type ThemeContextValue } from "./themeContextInstance";

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a Kasly ThemeProvider");
  }
  return context;
}
