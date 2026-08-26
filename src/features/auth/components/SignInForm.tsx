import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Button,
  Badge,
} from "@boredkevin/ui";

export function SignInForm() {
  const { t } = useTranslation();
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [signUpStep, setSignUpStep] = useState<1 | 2>(1);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [claimedName, setClaimedName] = useState<string | null>(null);
  const [nisn, setNisn] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyIdentity = useMutation(api.preRegistration.verifyClaimIdentity);

  const appSettings = useQuery(api.appSettings.get);
  const isRegLinksEnabled = appSettings?.enableRegistrationLinks !== false;
  const allowSignUps = appSettings?.allowSignUps !== false && !isRegLinksEnabled;
  const isPreRegRequired = appSettings?.enablePreRegistration === true;
  const effectiveFlow = !allowSignUps ? "signIn" : flow;

  const handleStep1Verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    try {
      const res = await verifyIdentity({
        nisn: nisn.trim(),
        birthYear: birthYear.trim(),
        phone: phone.trim(),
      });
      setClaimToken(res.claimToken);
      setClaimedName(res.displayName);
      setEmail("");
      setPassword("");
      setSignUpStep(2);
    } catch (err: any) {
      setError(err?.message || "Identity verification failed. Please check your credentials.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleStep2SignUp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("flow", "signUp");
    formData.set("email", email.trim().toLowerCase());
    formData.set("password", password);
    if (claimToken) {
      formData.set("claimToken", claimToken);
    }

    void signIn("password", formData).catch((err: Error) => {
      setError(err.message);
    });
  };

  const handleSignInSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("flow", "signIn");
    formData.set("email", email.trim().toLowerCase());
    formData.set("password", password);

    void signIn("password", formData).catch((err: Error) => {
      setError(err.message);
    });
  };

  const handleToggleFlow = () => {
    setError(null);
    setSignUpStep(1);
    setClaimToken(null);
    setClaimedName(null);
    setEmail("");
    setPassword("");
    setFlow(flow === "signIn" ? "signUp" : "signIn");
  };

  const handleBackToStep1 = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setEmail("");
    setPassword("");
    setClaimToken(null);
    setClaimedName(null);
    setSignUpStep(1);
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-sm mx-auto">
      <Card telemetry="AUTH" cornerLines={true} className="w-full">
        <CardHeader>
          <CardTitle className="text-base font-normal">
            <div className="flex flex-col gap-1">
              <p>
                {effectiveFlow === "signIn"
                  ? t("auth.signInTitle")
                  : isPreRegRequired && signUpStep === 1
                    ? t("auth.preReg.step1Title")
                    : isPreRegRequired && signUpStep === 2
                      ? t("auth.preReg.step2Title")
                      : t("auth.signUpTitle")}
              </p>
              {effectiveFlow === "signUp" && isPreRegRequired && (
                <p className="text-xs text-muted-foreground font-normal">
                  {signUpStep === 1
                    ? t("auth.preReg.step1Subtitle")
                    : t("auth.preReg.step2Subtitle")}
                </p>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {effectiveFlow === "signIn" ? (
            /* Sign In Form */
            <form key="signin-form" className="flex flex-col gap-4" onSubmit={handleSignInSubmit}>
              <Input
                key="signin-email"
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                chamfer="dual"
                autoComplete="email"
                required
              />
              <Input
                key="signin-password"
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordPlaceholder")}
                chamfer="dual"
                autoComplete="current-password"
                required
              />
              <Button
                variant="cyber"
                chamfer="dual"
                type="submit"
                className="w-full mt-2 cursor-pointer"
              >
                {t("auth.signInBtn")}
              </Button>
            </form>
          ) : isPreRegRequired && signUpStep === 1 ? (
            /* Pre-Registration Step 1 Form */
            <form key="step1-verify-form" className="flex flex-col gap-4" onSubmit={handleStep1Verify}>
              <div className="flex justify-between items-center mb-1">
                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                  {t("auth.preReg.stepIndicator", { current: 1, total: 2 })}
                </Badge>
              </div>
              <Input
                key="step1-nisn"
                type="text"
                name="nisn"
                value={nisn}
                onChange={(e) => setNisn(e.target.value)}
                placeholder={t("auth.preReg.nisnPlaceholder")}
                maxLength={10}
                chamfer="dual"
                autoComplete="off"
                required
              />
              <Input
                key="step1-birthYear"
                type="text"
                name="birthYear"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder={t("auth.preReg.birthYearPlaceholder")}
                maxLength={4}
                chamfer="dual"
                autoComplete="off"
                required
              />
              <Input
                key="step1-phone"
                type="tel"
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("auth.preReg.phonePlaceholder")}
                chamfer="dual"
                autoComplete="tel"
                required
              />
              <Button
                variant="cyber"
                chamfer="dual"
                type="submit"
                disabled={isVerifying}
                className="w-full mt-2 cursor-pointer"
              >
                {isVerifying ? t("auth.preReg.verifying") : t("auth.preReg.verifyBtn")}
              </Button>
            </form>
          ) : (
            /* Step 2 or Standard Sign Up Form */
            <div key="step2-container" className="flex flex-col gap-4">
              <form key="step2-signup-form" className="flex flex-col gap-4" onSubmit={handleStep2SignUp}>
                {isPreRegRequired && claimedName && (
                  <div className="bg-primary/10 border border-primary/30 p-3 chamfer-dual flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-foreground font-mono">
                        {t("auth.preReg.claimedStudent")}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {t("auth.preReg.stepIndicator", { current: 2, total: 2 })}
                      </Badge>
                    </div>
                    <p className="font-semibold text-sm text-foreground">{claimedName}</p>
                  </div>
                )}
                <Input
                  key="step2-email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.emailPlaceholder")}
                  chamfer="dual"
                  autoComplete="email"
                  required
                />
                <Input
                  key="step2-password"
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.passwordPlaceholder")}
                  chamfer="dual"
                  autoComplete="new-password"
                  required
                />
                <Button
                  variant="cyber"
                  chamfer="dual"
                  type="submit"
                  className="w-full mt-2 cursor-pointer"
                >
                  {isPreRegRequired
                    ? t("auth.preReg.completeSignUpBtn")
                    : t("auth.signUpBtn")}
                </Button>
              </form>

              {isPreRegRequired && (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={handleBackToStep1}
                  className="w-full text-xs cursor-pointer"
                >
                  {t("auth.preReg.backToVerify")}
                </Button>
              )}
            </div>
          )}

          {/* Toggle Flow Switcher */}
          {allowSignUps ? (
            <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 text-xs sm:text-sm items-center justify-center text-center mt-4">
              <span className="text-muted-foreground">
                {effectiveFlow === "signIn"
                  ? t("auth.dontHaveAccount")
                  : t("auth.alreadyHaveAccount")}
              </span>
              <span
                className="text-foreground underline hover:no-underline cursor-pointer font-medium"
                onClick={handleToggleFlow}
              >
                {effectiveFlow === "signIn"
                  ? t("auth.signUpInstead")
                  : t("auth.signInInstead")}
              </span>
            </div>
          ) : (
            <div className="text-center text-xs text-muted-foreground pt-3 font-mono">
              {isRegLinksEnabled
                ? t("auth.registrationLinkRequired")
                : t("auth.registrationsDisabled")}
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="bg-destructive/20 border border-destructive/50 rounded-none p-3 chamfer-dual mt-4">
              <p className="text-destructive-foreground font-mono text-xs">
                {t("common.error")}: {error}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

