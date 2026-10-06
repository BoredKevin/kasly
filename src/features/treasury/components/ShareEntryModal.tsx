import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@boredkevin/ui";
import { ResponsiveDialog, CopyField, StatusPill } from "../../../ui";
import {
  QrCode,
  Globe,
  Lock,
  ExternalLink,
} from "lucide-react";

interface ShareEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entryHash: string;
  sequenceNumber: number;
  fundName?: string;
  currency?: string;
  amount?: number;
  isPublic?: boolean;
}

export function ShareEntryModal({
  isOpen,
  onClose,
  entryHash,
  sequenceNumber,
  fundName = "Fund",
  currency = "IDR",
  amount,
  isPublic = true,
}: ShareEntryModalProps) {
  const { t } = useTranslation();
  const [showQr, setShowQr] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shortHash = entryHash.slice(0, 8);
  const shortUrl = `${origin}/${shortHash}`;

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Kasly Ledger Proof #${sequenceNumber}`,
          text: `Cryptographic proof for transaction #${sequenceNumber} in ${fundName} (${currency} ${amount?.toLocaleString() ?? ""})`,
          url: shortUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    }
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    shortUrl
  )}&margin=10`;

  const hasNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`${t("treasury.share.modalTitle", "Share Ledger Entry")} #${sequenceNumber}`}
      description={t(
        "treasury.share.modalDesc",
        "Public receipt and cryptographic proof link for this transaction."
      )}
      maxWidth="sm"
    >
      <div className="pt-2 space-y-4">
        {/* Privacy Notice with StatusPill */}
        <div
          className={`p-3 border rounded-[var(--fintech-radius-sm)] flex items-start gap-2.5 text-xs ${
            isPublic
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-amber-500/10 border-amber-500/30 text-amber-300"
          }`}
        >
          {isPublic ? (
            <Globe className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {isPublic ? "Public Receipt Enabled" : "Restricted Access"}
              </span>
              <StatusPill tone={isPublic ? "success" : "warning"}>
                {isPublic ? "Public" : "Private"}
              </StatusPill>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              {isPublic
                ? t("treasury.share.publicNotice", "Anyone with this link can independently verify cryptographic integrity.")
                : t("treasury.share.restrictedNotice", "Only authenticated organization members can view this receipt.")}
            </p>
          </div>
        </div>

        {/* Copyable Link Field */}
        <CopyField
          label={t("treasury.share.shortUrl", "Shareable Link")}
          value={shortUrl}
        />

        {/* Action Controls */}
        <div
          className={`pt-2 border-t border-border grid gap-2 ${
            hasNativeShare ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            chamfer="none"
            onClick={() => setShowQr(!showQr)}
            className="w-full h-8 text-xs flex items-center justify-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <QrCode className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {showQr
                ? t("treasury.share.hideQr", "Hide QR Code")
                : t("treasury.share.qrCode", "View QR Code")}
            </span>
          </Button>

          {hasNativeShare && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="none"
              onClick={() => {
                void handleNativeShare();
              }}
              className="w-full h-8 text-xs flex items-center justify-center gap-1.5 cursor-pointer bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t("treasury.share.shareVia", "Share...")}</span>
            </Button>
          )}
        </div>

        {/* QR Code Expansion */}
        {showQr && (
          <div className="p-4 bg-white rounded-[var(--fintech-radius-sm)] border border-border/60 flex flex-col items-center justify-center gap-2 animate-in fade-in zoom-in-95 duration-200">
            <img
              src={qrImageUrl}
              alt={`QR Code for entry #${sequenceNumber}`}
              className="w-44 h-44 rounded-sm"
              loading="lazy"
            />
            <span className="text-[10px] font-mono text-zinc-800 font-semibold text-center select-all">
              {shortUrl}
            </span>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
