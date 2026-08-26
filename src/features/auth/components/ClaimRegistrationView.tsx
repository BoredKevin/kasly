import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Button,
  Badge,
} from "@boredkevin/ui";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  KeyRound,
  ArrowRight,
  School,
  Lock,
  UserCheck,
} from "lucide-react";

export function ClaimRegistrationView() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { signIn } = useAuthActions();

  // Parse token from search params
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token") || "";

  const linkInfo = useQuery(
    api.preRegistration.getRegistrationLinkInfo,
    token ? { token } : "skip",
  );

  const verifyIdentity = useMutation(
    api.preRegistration.verifyRegistrationLinkIdentity,
  );

  // Verification step state
  const [step, setStep] = useState<1 | 2>(1);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [claimedName, setClaimedName] = useState<string | null>(null);

  // Form fields
  const [nisn, setNisn] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // UI state
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerifyStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    try {
      const res = await verifyIdentity({
        token,
        nisn: nisn.trim(),
        birthYear: birthYear.trim(),
        phone: phone.trim(),
      });

      setClaimToken(res.claimToken);
      setClaimedName(res.displayName);
      setStep(2);
    } catch (err: any) {
      setError(
        err?.message ||
          "Identity verification failed. Please check your NISN, birth year, and phone number.",
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSignUpStep2 = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSigningUp(true);

    const formData = new FormData(e.currentTarget);
    formData.set("flow", "signUp");
    formData.set("email", email.trim().toLowerCase());
    formData.set("password", password);
    if (claimToken) {
      formData.set("claimToken", claimToken);
    }

    void signIn("password", formData)
      .then(() => {
        // Redirection to profile/workspace will happen via authenticated state
        setLocation("/profile");
      })
      .catch((err: Error) => {
        setIsSigningUp(false);
        setError(err.message || "Failed to create account.");
      });
  };

  // Missing token in URL
  if (!token) {
    return (
      <Card telemetry="AUTH.CLAIM" cornerLines className="w-full max-w-md mx-auto bg-card border-border shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto p-3 bg-destructive/15 border border-destructive/40 text-destructive-foreground w-fit mb-2">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <CardTitle className="text-lg font-bold">
            {t("auth.claim.invalidLinkTitle")}
          </CardTitle>
          <CardDescription className="text-xs">
            {t("auth.claim.invalidLinkDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 flex justify-center">
          <Button
            variant="cyber"
            chamfer="dual"
            size="sm"
            onClick={() => setLocation("/")}
            className="cursor-pointer"
          >
            {t("auth.claim.goToSignIn")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (linkInfo === undefined) {
    return (
      <Card telemetry="AUTH.CLAIM_LOADING" cornerLines className="w-full max-w-md mx-auto bg-card border-border p-8 text-center animate-pulse">
        <div className="p-3 bg-primary/10 border border-primary/20 text-primary w-fit mx-auto mb-3">
          <KeyRound className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-xs font-mono text-muted-foreground">
          {t("common.loading")}
        </p>
      </Card>
    );
  }

  // Disabled feature
  if (!linkInfo.isEnabled) {
    return (
      <Card telemetry="AUTH.CLAIM_DISABLED" cornerLines className="w-full max-w-md mx-auto bg-card border-border shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto p-3 bg-amber-500/15 border border-amber-500/40 text-amber-400 w-fit mb-2">
            <Lock className="w-6 h-6" />
          </div>
          <CardTitle className="text-lg font-bold">
            {t("auth.claim.disabledTitle")}
          </CardTitle>
          <CardDescription className="text-xs">
            {linkInfo.errorReason || t("auth.claim.disabledDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 flex justify-center">
          <Button
            variant="outline"
            chamfer="dual"
            size="sm"
            onClick={() => setLocation("/")}
            className="cursor-pointer"
          >
            {t("auth.claim.goToSignIn")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Already claimed or invalid link
  if (!linkInfo.isValid) {
    return (
      <Card telemetry="AUTH.CLAIM_INVALID" cornerLines className="w-full max-w-md mx-auto bg-card border-border shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto p-3 bg-amber-500/15 border border-amber-500/40 text-amber-400 w-fit mb-2">
            {linkInfo.isClaimed ? (
              <UserCheck className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          <CardTitle className="text-lg font-bold">
            {linkInfo.isClaimed
              ? t("auth.claim.alreadyClaimed")
              : t("auth.claim.invalidLinkTitle")}
          </CardTitle>
          <CardDescription className="text-xs">
            {linkInfo.isClaimed
              ? t("auth.claim.alreadyClaimedDesc")
              : linkInfo.errorReason || t("auth.claim.invalidLinkDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 flex justify-center">
          <Button
            variant="cyber"
            chamfer="dual"
            size="sm"
            onClick={() => setLocation("/")}
            className="cursor-pointer"
          >
            {t("auth.claim.goToSignIn")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Welcome Banner Card */}
      <div className="bg-primary/10 border border-primary/30 p-4 chamfer-dual flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-primary font-bold">
            <School className="w-3.5 h-3.5" />
            <span>{linkInfo.organizationName}</span>
          </div>
          <h2 className="text-base font-bold text-foreground">
            {claimedName
              ? `${t("auth.preReg.claimedStudent")} ${claimedName}`
              : t("auth.claim.welcomeHeading")}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {step === 1
              ? t("auth.claim.welcomeSubheading")
              : t("auth.claim.step2Subtitle")}
          </p>
        </div>

        <Badge
          variant="outline"
          className="text-[10px] font-mono px-2 py-0.5 border-primary/40 text-primary uppercase shrink-0"
        >
          {t("auth.preReg.stepIndicator", { current: step, total: 2 })}
        </Badge>
      </div>

      <Card telemetry="AUTH.CLAIM_FORM" cornerLines className="w-full bg-card border-border shadow-2xl">
        <CardHeader className="pb-3 border-b border-border/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">
                {step === 1
                  ? t("auth.claim.step1Title")
                  : t("auth.claim.step2Title")}
              </CardTitle>
              <CardDescription className="text-xs">
                {step === 1
                  ? t("auth.preReg.step1Subtitle")
                  : t("auth.preReg.step2Subtitle")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {error && (
            <div className="p-3 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: 3-Factor Student Identity Confirmation */}
          {step === 1 && (
            <form onSubmit={handleVerifyStep1} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {t("treasury.preReg.nisn")}
                </label>
                <Input
                  type="text"
                  value={nisn}
                  onChange={(e) => setNisn(e.target.value)}
                  placeholder="10 numeric digits"
                  maxLength={10}
                  chamfer="dual"
                  autoComplete="off"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {t("treasury.preReg.birthYear")}
                </label>
                <Input
                  type="text"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  placeholder="4 digits (e.g. 2008)"
                  maxLength={4}
                  chamfer="dual"
                  autoComplete="off"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {t("treasury.preReg.phone")}
                </label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 08123456789"
                  chamfer="dual"
                  autoComplete="tel"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="cyber"
                chamfer="dual"
                disabled={isVerifying}
                className="w-full mt-2 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>
                  {isVerifying
                    ? t("auth.preReg.verifying")
                    : t("auth.preReg.verifyBtn")}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </form>
          )}

          {/* STEP 2: Email & Password Registration */}
          {step === 2 && (
            <form onSubmit={handleSignUpStep2} className="space-y-3.5">
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>
                    {t("auth.preReg.claimedStudent")}{" "}
                    <strong>{claimedName}</strong>
                  </span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-[9px] bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                >
                  VERIFIED
                </Badge>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {t("auth.emailPlaceholder")}
                </label>
                <Input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your-email@example.com"
                  chamfer="dual"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {t("auth.passwordPlaceholder")}
                </label>
                <Input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  chamfer="dual"
                  autoComplete="new-password"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="cyber"
                chamfer="dual"
                disabled={isSigningUp}
                className="w-full mt-2 cursor-pointer"
              >
                {isSigningUp
                  ? t("common.loading")
                  : t("auth.claim.completeBtn")}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  setStep(1);
                }}
                className="w-full text-xs cursor-pointer"
              >
                {t("auth.preReg.backToVerify")}
              </Button>
            </form>
          )}

          <div className="pt-2 text-center border-t border-border/40">
            <span
              onClick={() => setLocation("/")}
              className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
            >
              {t("auth.alreadyHaveAccount")} {t("auth.signInInstead")}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
