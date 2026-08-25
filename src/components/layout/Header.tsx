import { Authenticated } from "convex/react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { SignOutButton } from "../../features/auth";
import { User, Building2, Menu, X, Landmark } from "lucide-react";
import { Button } from "@boredkevin/ui";
import { useNavDrawer } from "./useNavDrawer";
import { LanguageToggle } from "../common";

export type ActiveNavTab = "profile" | "organization" | "treasury";

interface HeaderProps {
  activeTab?: ActiveNavTab;
  onTabChange?: (tab: ActiveNavTab) => void;
}

export function Header({ activeTab: explicitTab }: HeaderProps = {}) {
  const { t } = useTranslation();
  const { openMainNav, closeMainNav, isMainNavOpen } = useNavDrawer();
  const [location] = useLocation();

  const isProfileActive =
    explicitTab === "profile" || location === "/profile" || location === "/";
  const isOrgActive =
    explicitTab === "organization" || location.startsWith("/organization");
  const isTreasuryActive =
    explicitTab === "treasury" || location.startsWith("/treasury");

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md px-4 sm:px-6 py-3 border-b border-border/80 shadow-md flex justify-between items-center">
      <div className="flex items-center gap-3 sm:gap-6">
        {/* Mobile Navigation Trigger Button (Menu / Close) */}
        <Authenticated>
          <div className="md:hidden">
            <Button
              type="button"
              variant={isMainNavOpen ? "secondary" : "outline"}
              size="sm"
              chamfer="dual"
              onClick={isMainNavOpen ? closeMainNav : openMainNav}
              aria-label={isMainNavOpen ? t("nav.closeNavigation") : t("nav.openNavigation")}
              className="h-8 w-8 p-0 flex items-center justify-center cursor-pointer relative overflow-hidden"
            >
              <div
                className={`transition-all duration-300 transform ${isMainNavOpen ? "rotate-90 scale-100" : "rotate-0 scale-100"
                  }`}
              >
                {isMainNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </div>
            </Button>
          </div>
        </Authenticated>

        {/* Kasly Brand Logo */}
        <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
          <div className="p-1.5 bg-primary/10 border border-primary/30 text-primary font-bold font-mono text-xs">
            K
          </div>
          <span className="font-bold text-base tracking-tight text-foreground">
            Kasly
          </span>
        </Link>

        {/* Desktop Navigation Tabs */}
        <Authenticated>
          <nav className="hidden md:flex items-center gap-1 bg-muted/30 p-1 border border-border">
            <Link
              href="/profile"
              className={`px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${isProfileActive
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{t("nav.userProfile")}</span>
            </Link>

            <Link
              href="/organization"
              className={`px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${isOrgActive
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{t("nav.organization")}</span>
            </Link>

            <Link
              href="/treasury"
              className={`px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${isTreasuryActive
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>{t("nav.treasury")}</span>
            </Link>
          </nav>
        </Authenticated>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Language Switcher */}
        <LanguageToggle />

        <Authenticated>
          {/* Desktop Sign Out */}
          <div className="hidden sm:block">
            <SignOutButton />
          </div>
        </Authenticated>
      </div>
    </header>
  );
}
