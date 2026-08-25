import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Badge,
} from "@boredkevin/ui";
import {
  Scale,
  X,
  Search,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileCode,
  ShieldCheck,
} from "lucide-react";
import { ALL_LICENSES, LicenseEntry } from "../../data/licensesData";

interface LicensesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function LicenseCard({ entry }: { entry: LicenseEntry }) {
  const [isExpanded, setIsExpanded] = useState(entry.isPrimary ?? false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(
      `${entry.name} (${entry.version})\nLicense: ${entry.license}\n${entry.repository ? `Repository: ${entry.repository}\n` : ""}\n${entry.licenseText}`
    );
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      className={`border transition-all duration-150 ${entry.isPrimary
          ? "border-primary/50 bg-primary/5 shadow-sm"
          : "border-border/60 bg-muted/10 hover:border-border"
        }`}
    >
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3.5 flex items-start justify-between gap-3 cursor-pointer select-none"
      >
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold font-mono text-foreground flex items-center gap-1.5">
              {entry.isPrimary && (
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              )}
              {entry.name}
            </span>
            <Badge
              variant={entry.isPrimary ? "default" : "secondary"}
              className="text-[10px] font-mono"
            >
              {entry.version}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-border/80 text-muted-foreground"
            >
              {entry.license}
            </Badge>
          </div>

          {entry.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {entry.description}
            </p>
          )}

          {entry.author && (
            <div className="text-[11px] text-muted-foreground/80">
              By <span className="text-foreground/90 font-medium">{entry.author}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          {entry.repository && (
            <a
              href={entry.repository}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
              title="Open repository"
              aria-label={`Open repository for ${entry.name}`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Copy license text"
            aria-label={`Copy license text for ${entry.name}`}
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label={isExpanded ? "Collapse license details" : "Expand license details"}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-primary" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-border/40 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileCode className="w-3.5 h-3.5" />
              LICENSE TEXT
            </span>
            <span>{entry.license}</span>
          </div>
          <pre className="p-3 bg-black/40 border border-border/40 text-[11px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto rounded-none select-text">
            {entry.licenseText}
          </pre>
        </div>
      )}
    </div>
  );
}

function LicensesModalInner({ onClose }: { onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const filteredLicenses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return ALL_LICENSES;
    return ALL_LICENSES.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.license.toLowerCase().includes(query) ||
        (item.author && item.author.toLowerCase().includes(query)) ||
        (item.description && item.description.toLowerCase().includes(query))
    );
  }, [searchQuery]);

  return (
    <Card telemetry="SYS.LEGAL.LICENSES" cornerLines className="bg-card border-border shadow-2xl max-h-[88vh] flex flex-col">
      <CardHeader className="pb-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Open Source Licenses & Notices
              </CardTitle>
              <CardDescription className="text-xs">
                Third-party software and open source libraries powering Kasly
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            chamfer="dual"
            onClick={onClose}
            className="h-7 w-7 p-0 cursor-pointer"
            aria-label="Close licenses modal"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative mt-3">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search licenses by package, author, or license type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            chamfer="dual"
            className="pl-9 text-xs h-8"
          />
        </div>
      </CardHeader>

      <CardContent className="pt-4 overflow-y-auto space-y-3 flex-1 min-h-0">
        {filteredLicenses.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground font-mono">
            No licenses match "{searchQuery}".
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredLicenses.map((entry) => (
              <LicenseCard key={entry.name} entry={entry} />
            ))}
          </div>
        )}
      </CardContent>

      <div className="p-3 border-t border-border bg-muted/20 shrink-0 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
        <span>{filteredLicenses.length} packages listed</span>
        <Button
          type="button"
          variant="outline"
          chamfer="dual"
          size="sm"
          onClick={onClose}
          className="text-xs cursor-pointer h-7"
        >
          Close
        </Button>
      </div>
    </Card>
  );
}

export function LicensesModal(props: LicensesModalProps) {
  if (!props.isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          props.onClose();
        }
      }}
    >
      <div className="w-full max-w-2xl">
        <LicensesModalInner onClose={props.onClose} />
      </div>
    </div>,
    document.body
  );
}
