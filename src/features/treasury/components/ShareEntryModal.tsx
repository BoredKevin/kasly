import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from "@boredkevin/ui";
import {
  X,
  Copy,
  Check,
  Share2,
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  if (!isOpen || typeof document === "undefined") return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shortHash = entryHash.slice(0, 8);
  const shortUrl = `${origin}/${shortHash}`;
  const canonicalUrl = `${origin}/tx/${entryHash}`;

  const handleCopy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Kasly Ledger Proof #${sequenceNumber}`,
          text: `Cryptographic proof for transaction #${sequenceNumber} in ${fundName} (${currency} ${amount?.toLocaleString() ?? ""})`,
          url: shortUrl,
        });
      } catch {
        // User cancelled or share failed, fallback to copy
        handleCopy(shortUrl, "short");
      }
    } else {
      handleCopy(shortUrl, "short");
    }
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    shortUrl
  )}&margin=10`;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md">
        <Card
          telemetry="TREASURY.SHARE_ENTRY"
          cornerLines
          className="bg-card border-border shadow-2xl"
        >
          <CardHeader className="pb-3 border-b border-border/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <span>{t("treasury.share.modalTitle")}</span>
                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                      #{sequenceNumber}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t("treasury.share.modalDesc")}
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                chamfer="dual"
                onClick={onClose}
                className="h-7 w-7 p-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4 text-xs font-mono">
            {/* Privacy Policy Banner */}
            <div
              className={`p-2.5 border flex items-start gap-2 text-[11px] ${
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
              <p className="font-sans leading-relaxed">
                {isPublic
                  ? t("treasury.share.publicNotice")
                  : t("treasury.share.restrictedNotice")}
              </p>
            </div>

            {/* Native Short Link Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  {t("treasury.share.shortUrl")}
                </span>
                <span className="text-[10px] text-primary font-mono font-bold">
                  kasly.bkev.in/{shortHash}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-muted/20 p-2 border border-border/70">
                <input
                  type="text"
                  readOnly
                  value={shortUrl}
                  className="bg-transparent text-xs text-foreground font-mono w-full focus:outline-none select-all"
                />
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  chamfer="dual"
                  onClick={() => handleCopy(shortUrl, "short")}
                  className="h-7 px-2.5 text-[11px] shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === "short" ? (
                    <>
                      <Check className="w-3 h-3 text-black" />
                      <span>{t("treasury.ledger.copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>{t("treasury.share.copyLink")}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Canonical Full Transaction Link Box */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                {t("treasury.share.canonicalUrl")}
              </span>
              <div className="flex items-center gap-2 bg-muted/20 p-2 border border-border/70">
                <input
                  type="text"
                  readOnly
                  value={canonicalUrl}
                  className="bg-transparent text-[11px] text-muted-foreground font-mono w-full focus:outline-none select-all truncate"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="dual"
                  onClick={() => handleCopy(canonicalUrl, "canonical")}
                  className="h-7 px-2.5 text-[11px] shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === "canonical" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>{t("treasury.ledger.copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>{t("treasury.share.copyLink")}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* QR Code Section Toggle */}
            <div className="pt-2 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="dual"
                onClick={() => setShowQr(!showQr)}
                className="w-full h-8 text-xs flex items-center justify-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>
                  {showQr ? "Hide QR Code" : t("treasury.share.qrCode")}
                </span>
              </Button>

              {showQr && (
                <div className="mt-3 p-4 bg-white/95 border border-border/60 flex flex-col items-center justify-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                  <img
                    src={qrImageUrl}
                    alt={`QR Code for entry #${sequenceNumber}`}
                    className="w-44 h-44 border border-black/10"
                    loading="lazy"
                  />
                  <span className="text-[10px] font-mono text-black/70 font-semibold text-center">
                    kasly.bkev.in/{shortHash}
                  </span>
                </div>
              )}
            </div>

            {/* Web Share API Action (Mobile / Desktop Supported) */}
            {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="dual"
                  onClick={() => {
                    void handleNativeShare();
                  }}
                  className="w-full h-8 text-xs flex items-center justify-center gap-2 cursor-pointer bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t("treasury.share.shareVia")}</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
