import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

interface LanguageToggleProps {
  className?: string;
  compact?: boolean;
}

export function LanguageToggle({ className = "", compact = false }: LanguageToggleProps) {
  const { i18n } = useTranslation();
  const currentLang = (i18n.resolvedLanguage || i18n.language || "en").startsWith("id")
    ? "id"
    : "en";

  const handleLanguageChange = (newLang: "en" | "id") => {
    void i18n.changeLanguage(newLang);
  };

  const toggleLanguage = () => {
    handleLanguageChange(currentLang === "en" ? "id" : "en");
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleLanguage}
        title={currentLang === "en" ? "Ganti bahasa ke Indonesia" : "Switch language to English"}
        className={`flex items-center gap-1.5 px-2 py-1 bg-muted/40 hover:bg-muted/70 border border-border/70 text-xs font-mono font-semibold transition-all cursor-pointer select-none ${className}`}
      >
        <Globe className="w-3.5 h-3.5 text-primary" />
        <span className="uppercase">{currentLang}</span>
      </button>
    );
  }

  return (
    <div
      className={`inline-flex items-center p-0.5 bg-muted/30 border border-border/70 font-mono text-xs ${className}`}
      role="group"
      aria-label="Language selector"
    >
      <button
        type="button"
        onClick={() => handleLanguageChange("en")}
        aria-pressed={currentLang === "en"}
        className={`px-2 py-0.5 font-bold transition-all cursor-pointer ${
          currentLang === "en"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => handleLanguageChange("id")}
        aria-pressed={currentLang === "id"}
        className={`px-2 py-0.5 font-bold transition-all cursor-pointer ${
          currentLang === "id"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        ID
      </button>
    </div>
  );
}
