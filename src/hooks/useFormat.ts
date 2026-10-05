import { useTranslation } from "react-i18next";
import { useMemo } from "react";

export function useFormat() {
  const { i18n, t } = useTranslation();
  const currentLang = i18n.resolvedLanguage || i18n.language || "en";
  const locale = currentLang.startsWith("id") ? "id-ID" : "en-US";

  return useMemo(() => {
    const moneyFormatterCache = new Map<string, Intl.NumberFormat>();

    const money = (amount: number, currency = "IDR"): string => {
      let formatter = moneyFormatterCache.get(currency);
      if (!formatter) {
        try {
          formatter = new Intl.NumberFormat(locale, {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
          });
          moneyFormatterCache.set(currency, formatter);
        } catch {
          return `${currency} ${amount.toLocaleString(locale)}`;
        }
      }
      return formatter.format(amount);
    };

    const number = (val: number): string => {
      return val.toLocaleString(locale);
    };

    const date = (
      timestamp: number | Date,
      options: Intl.DateTimeFormatOptions = {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    ): string => {
      const d = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
      return new Intl.DateTimeFormat(locale, options).format(d);
    };

    const dateTime = (timestamp: number | Date): string => {
      const d = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
      return new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
      }).format(d);
    };

    const relative = (timestamp: number | Date): string => {
      const ms = typeof timestamp === "number" ? timestamp : timestamp.getTime();
      const diffMs = Date.now() - ms;
      const diffSec = Math.floor(diffMs / 1000);

      if (diffSec < 60) return t("time.justNow", "just now");
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return t("time.minutesAgo", `${diffMin}m ago`, { count: diffMin });
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return t("time.hoursAgo", `${diffHours}h ago`, { count: diffHours });
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return t("time.yesterday", "yesterday");
      if (diffDays < 30) return t("time.daysAgo", `${diffDays}d ago`, { count: diffDays });

      return date(ms);
    };

    return {
      money,
      number,
      date,
      dateTime,
      relative,
      locale,
    };
  }, [locale, t]);
}
