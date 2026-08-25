import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
} from "@boredkevin/ui";
import { KeyRound, X, Sparkles, CheckCircle2, Shield, AlertTriangle } from "lucide-react";
import {
  generateTreasurerKeypair,
  exportPublicKeyJwk,
  computeKeyIdFromJwk,
  storeKeypair,
} from "../../../lib/treasury-crypto";

interface GenerateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  onSuccess?: () => void;
}

export function GenerateKeyModal({
  isOpen,
  onClose,
  organizationId,
  onSuccess,
}: GenerateKeyModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [label, setLabel] = useState("");
  const [generatedKeyId, setGeneratedKeyId] = useState<string | null>(null);
  const [generatedJwk, setGeneratedJwk] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestRegistration = useMutation(api.treasury.keys.requestKeyRegistration);

  if (!isOpen || typeof document === "undefined") return null;

  const handleReset = () => {
    setStep(1);
    setLabel("");
    setGeneratedKeyId(null);
    setGeneratedJwk(null);
    setError(null);
    setIsProcessing(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Step 1: Generate keypair locally in browser
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);

    try {
      const keypair = await generateTreasurerKeypair();
      const jwkString = await exportPublicKeyJwk(keypair.publicKey);
      const keyId = await computeKeyIdFromJwk(jwkString);

      // Save securely into IndexedDB
      await storeKeypair(keyId, keypair, jwkString, label.trim() || undefined);

      setGeneratedKeyId(keyId);
      setGeneratedJwk(jwkString);
      setStep(2);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to generate keypair in browser."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 2: Submit public key to backend for admin approval
  const handleSubmitApproval = async () => {
    if (!generatedKeyId || !generatedJwk) return;

    setIsProcessing(true);
    setError(null);

    try {
      await requestRegistration({
        organizationId,
        publicKeyJwk: generatedJwk,
        label: label.trim() ? label.trim() : undefined,
      });

      onSuccess?.();
      handleClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to submit key registration request."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md">
        <Card telemetry="TREASURY.KEYGEN" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {step === 1 ? t("treasury.generateKey.title") : "Submit Key For Approval"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {step === 1
                      ? t("treasury.generateKey.description")
                      : "Step 2 of 2: Request administrator authorization"}
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

          <CardContent className="pt-5">
            {step === 1 ? (
              <form
                onSubmit={(e) => {
                  void handleGenerate(e);
                }}
                className="space-y-4"
              >
                <div className="p-3 bg-primary/5 border border-primary/20 text-xs flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">
                      Non-Extractable Cryptography
                    </p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Your ECDSA P-256 private key is generated locally and stored securely in this browser&apos;s IndexedDB. It is never transmitted across the network.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    {t("treasury.generateKey.label")}
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Work MacBook, Office Desktop"
                    value={label}
                    disabled={isProcessing}
                    onChange={(e) => setLabel(e.target.value)}
                    chamfer="dual"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    A friendly name to help you and administrators identify this device.
                  </p>
                </div>

                {error && (
                  <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono">
                    {error}
                  </div>
                )}

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    chamfer="dual"
                    onClick={handleClose}
                    disabled={isProcessing}
                    size="sm"
                    className="text-xs cursor-pointer"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    variant="cyber"
                    chamfer="dual"
                    size="sm"
                    disabled={isProcessing}
                    className="text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {isProcessing ? (
                      <span>{t("common.loading")}</span>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{t("treasury.generateKey.submit")}</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-emerald-300">
                      Keypair Generated & Stored
                    </p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Your keypair is safely installed in this browser. To start signing ledger entries, submit this key fingerprint for administrator authorization.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-background border border-border/80 space-y-2">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">
                    Key Fingerprint (keyId)
                  </div>
                  <div className="font-mono text-sm font-bold text-primary tracking-widest bg-muted/40 p-2 border border-border/60 text-center select-all">
                    {generatedKeyId}
                  </div>
                  {label && (
                    <div className="text-xs text-muted-foreground flex items-center justify-between pt-1">
                      <span>Label:</span>
                      <span className="font-semibold text-foreground">{label}</span>
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    The key will remain in <strong className="text-amber-200">Pending</strong> status until an organization admin approves it in the Admin Panel.
                  </span>
                </div>

                {error && (
                  <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono">
                    {error}
                  </div>
                )}

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    chamfer="dual"
                    onClick={handleClose}
                    disabled={isProcessing}
                    size="sm"
                    className="text-xs cursor-pointer"
                  >
                    Close (Submit Later)
                  </Button>
                  <Button
                    type="button"
                    variant="cyber"
                    chamfer="dual"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => {
                      void handleSubmitApproval();
                    }}
                    className="text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {isProcessing ? (
                      <span>Submitting...</span>
                    ) : (
                      <>
                        <Shield className="w-3.5 h-3.5" />
                        <span>Submit for Admin Approval</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
