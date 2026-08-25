import { useState } from "react";
import { APP_VERSION } from "../../data/licensesData";
import { LicensesModal } from "./LicensesModal";

export function Footer() {
  const [isLicensesOpen, setIsLicensesOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  return (
    <>
      <footer className="w-full border-t border-border/40 bg-background/50 backdrop-blur-sm py-4 px-4 sm:px-8 mt-auto relative z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-center text-center text-xs text-muted-foreground font-mono">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span>&copy; {currentYear}</span>
            <a
              href="https://github.com/boredkevin/kasly"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
            >
              boredkevin/kasly
            </a>
            <span>v{APP_VERSION}</span>
            <span className="text-muted-foreground/60 select-none">•</span>
            <span className="text-muted-foreground bg-primary/10 py-0.5 rounded-none">
              {__BUILD_HASH__}
            </span>
            <span className="text-muted-foreground/60 select-none">•</span>
            <button
              type="button"
              onClick={() => setIsLicensesOpen(true)}
              className="text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline cursor-pointer"
            >
              Licenses
            </button>
          </div>
        </div>
      </footer>

      <LicensesModal
        isOpen={isLicensesOpen}
        onClose={() => setIsLicensesOpen(false)}
      />
    </>
  );
}
