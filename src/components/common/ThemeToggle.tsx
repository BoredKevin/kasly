import { useTranslation } from "react-i18next";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../contexts";

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

export function ThemeToggle({
  className = "",
  compact = false,
}: ThemeToggleProps) {
  const { t } = useTranslation();
  const { resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (compact) {
    const isDark = resolvedTheme === "dark";
    return (
      <button
        type="button"
        onClick={toggleTheme}
        title={
          isDark
            ? t("theme.switchToLight", "Switch to light mode")
            : t("theme.switchToDark", "Switch to dark mode")
        }
        aria-label={
          isDark
            ? t("theme.switchToLight", "Switch to light mode")
            : t("theme.switchToDark", "Switch to dark mode")
        }
        className={`flex items-center gap-1.5 px-2 py-1 bg-muted/40 hover:bg-muted/70 border border-border/70 text-xs font-mono font-semibold transition-all cursor-pointer select-none rounded-[var(--fintech-radius-xs)] ${className}`}
      >
        {isDark ? (
          <Sun className="w-3.5 h-3.5 text-primary" />
        ) : (
          <Moon className="w-3.5 h-3.5 text-primary" />
        )}
        <span className="uppercase">{resolvedTheme}</span>
      </button>
    );
  }

  return (
    <div
      className={`inline-flex items-center p-0.5 bg-muted/30 border border-border/70 font-mono text-xs rounded-[var(--fintech-radius-xs)] ${className}`}
      role="group"
      aria-label={t("nav.theme", "Theme selector")}
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={resolvedTheme === "light"}
        className={`flex items-center gap-1.5 px-2 py-0.5 font-bold transition-all cursor-pointer rounded-[var(--fintech-radius-xs)] ${
          resolvedTheme === "light"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Sun className="w-3 h-3" />
        <span>{t("theme.light", "Light")}</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={resolvedTheme === "dark"}
        className={`flex items-center gap-1.5 px-2 py-0.5 font-bold transition-all cursor-pointer rounded-[var(--fintech-radius-xs)] ${
          resolvedTheme === "dark"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Moon className="w-3 h-3" />
        <span>{t("theme.dark", "Dark")}</span>
      </button>
    </div>
  );
}

export default ThemeToggle;
