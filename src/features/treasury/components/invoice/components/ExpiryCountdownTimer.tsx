import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";

export interface ExpiryCountdownTimerProps {
  expiresAt?: number;
  className?: string;
}

export function ExpiryCountdownTimer({ expiresAt, className = "" }: ExpiryCountdownTimerProps) {
  const { t, i18n } = useTranslation();
  const [timeLeft, setTimeLeft] = useState<string>("--:--");
  const [isUrgent, setIsUrgent] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;

    const calculate = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft(i18n.language === "id" ? "Kedaluwarsa" : "Expired");
        return;
      }

      setIsExpired(false);
      setIsUrgent(diff < 5 * 60 * 1000); // Less than 5 minutes

      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const pad = (n: number) => String(n).padStart(2, "0");

      if (days > 0) {
        const daysLabel = i18n.language === "id" ? "hari" : "d";
        setTimeLeft(`${days} ${daysLabel} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      } else if (hours > 0) {
        setTimeLeft(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      } else {
        setTimeLeft(`${pad(minutes)}:${pad(seconds)}`);
      }
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, i18n.language]);

  return (
    <div className={`text-center space-y-1.5 font-sans ${className}`}>
      <span className="text-xs font-sans font-medium text-muted-foreground flex items-center justify-center gap-1.5">
        <Clock className={`w-3.5 h-3.5 ${isUrgent ? "text-amber-400 animate-pulse" : "text-primary"}`} />
        <span>{t("treasury.invoices.checkout.completePaymentIn", "Complete payment in")}</span>
      </span>
      <div
        className={`font-sans text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums ${
          isExpired
            ? "text-destructive"
            : isUrgent
              ? "text-amber-400 animate-pulse"
              : "text-foreground"
        }`}
      >
        {timeLeft}
      </div>
    </div>
  );
}
