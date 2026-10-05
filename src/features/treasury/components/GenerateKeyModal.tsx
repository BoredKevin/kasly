import { useState } from "react";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button, Input } from "@boredkevin/ui";
import { ResponsiveDialog, CopyField } from "../../../ui";
import { KeyRound, Sparkles, CheckCircle2, Shield, AlertTriangle } from "lucide-react";
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

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 1 ? t("treasury.generateKey.title", "Generate Signing Key") : "Submit Key For Approval"}
      description={
        step === 1
          ? t("treasury.generateKey.description", "Create a non-extractable cryptographic key on this device.")
          : "Step 2 of 2: Request administrator authorization to sign ledger entries."
      }
      maxWidth="md"
    >
      <div className="pt-2">
        {step === 1 ? (
          <form
            onSubmit={(e) => {
              void handleGenerate(e);
            }}
            className="space-y-4"
          >
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-[var(--fintech-radius-sm)] text-xs flex items-start gap-2.5">
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
              <label className="text-xs font-semibold text-foreground">
                {t("treasury.generateKey.label", "Device Label")}
              </label>
              <Input
                type="text"
                placeholder="e.g. Work MacBook, Office Desktop"
                value={label}
                disabled={isProcessing}
                onChange={(e) => setLabel(e.target.value)}
                chamfer="none"
              />
              <p className="text-[11px] text-muted-foreground">
                A friendly name to help you and administrators identify this device.
              </p>
            </div>

            {error && (
              <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs rounded-[var(--fintech-radius-sm)]">
                {error}
              </div>
            )}

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                chamfer="none"
                onClick={handleClose}
                disabled={isProcessing}
                size="sm"
                className="text-xs cursor-pointer"
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                type="submit"
                variant="cyber"
                chamfer="none"
                size="sm"
                disabled={isProcessing}
                className="text-xs flex items-center gap-1.5 cursor-pointer font-semibold"
              >
                {isProcessing ? (
                  <span>{t("common.loading", "Generating...")}</span>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t("treasury.generateKey.submit", "Generate Keypair")}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-[var(--fintech-radius-sm)] text-xs flex items-start gap-2.5">
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

            {generatedKeyId && (
              <CopyField
                label="Key Fingerprint (keyId)"
                value={generatedKeyId}
              />
            )}

            {label && (
              <div className="text-xs text-muted-foreground flex items-center justify-between px-1">
                <span>Device Label:</span>
                <span className="font-semibold text-foreground">{label}</span>
              </div>
            )}

            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-[var(--fintech-radius-sm)] text-amber-300 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                The key will remain in <strong className="text-amber-200">Pending</strong> status until an organization admin approves it in the Admin Panel.
              </span>
            </div>

            {error && (
              <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs rounded-[var(--fintech-radius-sm)]">
                {error}
              </div>
            )}

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                chamfer="none"
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
                chamfer="none"
                size="sm"
                disabled={isProcessing}
                onClick={() => {
                  void handleSubmitApproval();
                }}
                className="text-xs flex items-center gap-1.5 cursor-pointer font-semibold"
              >
                {isProcessing ? (
                  <span>Submitting...</span>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Submit for Admin Approval</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
