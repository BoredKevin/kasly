import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Landmark, Receipt, CalendarDays, ScrollText, MoreHorizontal } from "lucide-react";

export interface BottomTabsProps {
  onOpenMore: () => void;
  isMoreOpen?: boolean;
}

export function BottomTabs({ onOpenMore, isMoreOpen = false }: BottomTabsProps) {
  const { t } = useTranslation();
  const [location] = useLocation();

  const isOverview = location === "/treasury" || location === "/";
  const isInvoices = location.startsWith("/treasury/invoices");
  const isDues = location.startsWith("/treasury/dues");
  const isLedger = location.startsWith("/treasury/ledger") || location.startsWith("/tx/");

  const isMoreActive =
    isMoreOpen ||
    location.startsWith("/organization") ||
    location.startsWith("/profile") ||
    location.startsWith("/treasury/keys") ||
    location.startsWith("/treasury/admin") ||
    location.startsWith("/treasury/bulk-dues");

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 pb-[env(safe-area-inset-bottom,0px)]"
      style={{
        backgroundColor: "rgba(10, 10, 12, 0.88)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.5)",
      }}
      aria-label="Mobile Navigation"
    >
      <div className="grid grid-cols-5 h-14 items-center">
        {/* Overview */}
        <Link
          href="/treasury"
          className={`flex flex-col items-center justify-center h-full gap-0.5 transition-colors cursor-pointer ${
            isOverview
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Landmark className={`w-4 h-4 ${isOverview ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
          <span className="text-[10px] tracking-tight">{t("nav.overview") || "Home"}</span>
        </Link>

        {/* Invoices */}
        <Link
          href="/treasury/invoices"
          className={`flex flex-col items-center justify-center h-full gap-0.5 transition-colors cursor-pointer ${
            isInvoices
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Receipt className={`w-4 h-4 ${isInvoices ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
          <span className="text-[10px] tracking-tight">{t("nav.invoices") || "Invoices"}</span>
        </Link>

        {/* Dues */}
        <Link
          href="/treasury/dues"
          className={`flex flex-col items-center justify-center h-full gap-0.5 transition-colors cursor-pointer ${
            isDues
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CalendarDays className={`w-4 h-4 ${isDues ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
          <span className="text-[10px] tracking-tight">{t("nav.duesAndPayments") || "Dues"}</span>
        </Link>

        {/* Activity / Ledger */}
        <Link
          href="/treasury/ledger"
          className={`flex flex-col items-center justify-center h-full gap-0.5 transition-colors cursor-pointer ${
            isLedger
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ScrollText className={`w-4 h-4 ${isLedger ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
          <span className="text-[10px] tracking-tight">{t("nav.ledger") || "Activity"}</span>
        </Link>

        {/* More */}
        <button
          type="button"
          onClick={onOpenMore}
          className={`flex flex-col items-center justify-center h-full gap-0.5 transition-colors cursor-pointer ${
            isMoreActive
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="More navigation and tools"
        >
          <MoreHorizontal className={`w-4 h-4 ${isMoreActive ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
          <span className="text-[10px] tracking-tight">More</span>
        </button>
      </div>
    </nav>
  );
}
