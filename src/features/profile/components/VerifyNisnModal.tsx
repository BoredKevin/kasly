import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
} from "@boredkevin/ui";
import {
  Fingerprint,
  X,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Hash,
} from "lucide-react";

interface VerifyNisnModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConfigured: boolean;
}

export function VerifyNisnModal({
  isOpen,
  onClose,
  isConfigured,
}: VerifyNisnModalProps) {
  const { t } = useTranslation();
  const [nisnInput, setNisnInput] = useState("");
  const [showNisn, setShowNisn] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const verifyNisn = useMutation(api.nisn.verify);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNisnInput("");
        setResult(null);
        setShowNisn(false);
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
    setNisnInput(value);
    if (result) {
      setResult(null);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nisnInput.length !== 10) return;

    setIsVerifying(true);
    setResult(null);

    try {
      const res = await verifyNisn({ nisn: nisnInput });
      setResult({
        success: res.verified,
        message: res.message,
      });
    } catch (err: unknown) {
      setResult({
        success: false,
        message:
          err instanceof Error ? err.message : "Verification failed.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setNisnInput("");
    setResult(null);
    setShowNisn(false);
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="w-full max-w-md my-auto">
        <Card
          telemetry="USER.NISN.VERIFY"
          cornerLines
          className="bg-card border-border shadow-2xl"
        >
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t("profile.nisn.verifyTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t("profile.nisn.verifyDescription")}
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                chamfer="dual"
                onClick={handleClose}
                className="h-7 w-7 p-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            {/* Status & Security info */}
            <div className="p-3 bg-muted/20 border border-border/60 text-xs flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-muted-foreground text-[11px] leading-relaxed">
                <p className="font-medium text-foreground">
                  Encrypted Identification
                </p>
                <p>
                  NISN is a 10-digit private identifier stored as a salted SHA-256 cryptographic hash. It cannot be altered once provisioned.
                </p>
              </div>
            </div>

            {!isConfigured ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-[11px]">
                    {t("profile.nisn.unassigned")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Your account does not have a NISN assigned yet. Please contact an administrator to provision your identification number.
                  </p>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  void handleVerify(e);
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-medium text-foreground flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-primary" />
                      {t("profile.nisn.enter10Digit")} *
                    </label>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {nisnInput.length}/10 DIGITS
                    </span>
                  </div>

                  <div className="relative">
                    <Input
                      type={showNisn ? "text" : "password"}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="e.g. 1234567890"
                      value={nisnInput}
                      onChange={handleInputChange}
                      chamfer="dual"
                      className="font-mono text-sm tracking-widest h-9 pr-9"
                      maxLength={10}
                      autoFocus
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNisn(!showNisn)}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title={showNisn ? "Hide NISN" : "Show NISN"}
                      tabIndex={-1}
                    >
                      {showNisn ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Type your 10 numeric digits to check against the secure database hash
                  </p>
                </div>

                {/* Feedback Result */}
                {result && (
                  <div
                    className={`p-3 border text-xs flex items-start gap-2.5 animate-in fade-in duration-200 ${
                      result.success
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}
                  >
                    {result.success ? (
                      <Check className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span className="font-mono text-[11px] leading-relaxed">
                      {result.message}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    chamfer="dual"
                    size="sm"
                    onClick={handleClose}
                    className="text-xs cursor-pointer"
                  >
                    {t("common.close")}
                  </Button>
                  <Button
                    type="submit"
                    variant="cyber"
                    chamfer="dual"
                    size="sm"
                    disabled={isVerifying || nisnInput.length !== 10}
                    className="text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{isVerifying ? t("common.loading") : t("profile.nisn.verifyButton")}</span>
                  </Button>
                </div>
              </form>
            )}

            {!isConfigured && (
              <div className="flex justify-end pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  chamfer="dual"
                  size="sm"
                  onClick={handleClose}
                  className="text-xs cursor-pointer"
                >
                  {t("common.close")}
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
