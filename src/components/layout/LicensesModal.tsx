import { useState, useMemo } from "react";
import {
  Button,
  Input,
  Badge,
} from "@boredkevin/ui";
import { ResponsiveDialog } from "../../ui";
import {
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
      `${entry.name}\nLicense: ${entry.license}\n${entry.repository ? `Repository: ${entry.repository}\n` : ""}\n${entry.licenseText}`
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
    <div className="space-y-4 pt-1">
      {/* Search Bar */}
      <div className="relative">
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

      <div className="max-h-[60vh] overflow-y-auto space-y-2.5 pr-1">
        {filteredLicenses.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground font-mono">
            No licenses match "{searchQuery}".
          </div>
        ) : (
          filteredLicenses.map((entry) => (
            <LicenseCard key={entry.name} entry={entry} />
          ))
        )}
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground">
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
    </div>
  );
}

export function LicensesModal(props: LicensesModalProps) {
  if (!props.isOpen) return null;

  return (
    <ResponsiveDialog
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="Open Source Licenses & Notices"
      description="Third-party software and open source libraries powering Kasly"
      maxWidth="xl"
    >
      <LicensesModalInner onClose={props.onClose} />
    </ResponsiveDialog>
  );
}
