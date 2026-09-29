import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { formatAuthError } from "../utils/authErrors";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Button,
  Badge,
} from "@boredkevin/ui";

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { signIn } = useAuthActions();
  const [, setLocation] = useLocation();

  const getParam = (key: string): string => {
    const searchParams = new URLSearchParams(window.location.search);
    const searchVal = searchParams.get(key);
    if (searchVal) return searchVal.trim();

    if (window.location.hash && window.location.hash.includes("?")) {
      const hashQuery = window.location.hash.slice(
        window.location.hash.indexOf("?") + 1,
      );
      const hashParams = new URLSearchParams(hashQuery);
      const hashVal = hashParams.get(key);
      if (hashVal) return hashVal.trim();
    }

    return "";
  };

  const code = getParam("token") || getParam("code");
  const email = getParam("email");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValidLink = Boolean(code && email);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError(t("auth.reset.passwordsDoNotMatch"));
      return;
    }

    if (newPassword.length < 8) {
      setError(
        t(
          "auth.passwordRequirements",
          "Password must be at least 8 characters long.",
        ),
      );
      return;
    }

    setIsSubmitting(true);

    void signIn("password", {
      email: email.toLowerCase(),
      code,
      newPassword,
      flow: "reset-verification",
    })
      .then(() => {
        // Successful reset automatically signs the user in
        setLocation("/");
      })
      .catch((err: unknown) => {
        setError(formatAuthError(err));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-sm mx-auto">
      <Card telemetry="AUTH.RESET" cornerLines={true} className="w-full">
        <CardHeader>
          <CardTitle className="text-base font-normal">
            <div className="flex flex-col gap-1">
              <p>
                {isValidLink
                  ? t("auth.reset.setNewPasswordTitle")
                  : t("auth.reset.invalidLinkTitle")}
              </p>
              <p className="text-xs text-muted-foreground font-normal">
                {isValidLink
                  ? t("auth.reset.setNewPasswordSubtitle")
                  : t("auth.reset.invalidLinkDesc")}
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isValidLink ? (
            <div className="flex flex-col gap-4">
              <Button
                variant="cyber"
                chamfer="dual"
                type="button"
                onClick={() => setLocation("/")}
                className="w-full cursor-pointer"
              >
                {t("auth.reset.backToSignIn")}
              </Button>
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="bg-primary/10 border border-primary/30 p-2.5 chamfer-dual flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                  {email}
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  VERIFIED
                </Badge>
              </div>

              <Input
                type="password"
                name="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("auth.reset.newPasswordPlaceholder")}
                chamfer="dual"
                autoComplete="new-password"
                required
              />

              <Input
                type="password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("auth.reset.confirmPasswordPlaceholder")}
                chamfer="dual"
                autoComplete="new-password"
                required
              />

              <Button
                variant="cyber"
                chamfer="dual"
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 cursor-pointer"
              >
                {isSubmitting
                  ? t("auth.reset.savingPassword")
                  : t("auth.reset.savePasswordBtn")}
              </Button>

              <Button
                variant="outline"
                type="button"
                onClick={() => setLocation("/")}
                className="w-full text-xs cursor-pointer"
              >
                {t("auth.reset.backToSignIn")}
              </Button>

              {error && (
                <div className="bg-destructive/20 border border-destructive/50 rounded-none p-3 chamfer-dual mt-2">
                  <p className="text-destructive-foreground font-mono text-xs">
                    {t("common.error")}: {error}
                  </p>
                </div>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
