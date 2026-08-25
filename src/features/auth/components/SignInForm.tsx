import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Button,
} from "@boredkevin/ui";

export function SignInForm() {
  const { t } = useTranslation();
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);

  const appSettings = useQuery(api.appSettings.get);
  const allowSignUps = appSettings?.allowSignUps !== false;
  const effectiveFlow = !allowSignUps ? "signIn" : flow;

  return (
    <div className="flex flex-col gap-8 w-full max-w-sm mx-auto">
      <Card telemetry="AUTH" cornerLines={true} className="w-full">
        <CardHeader>
          <CardTitle className="text-base font-normal">
            <p>
              {effectiveFlow === "signIn"
                ? t("auth.signInTitle")
                : t("auth.signUpTitle")}
            </p>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              formData.set("flow", effectiveFlow);
              void signIn("password", formData).catch((err: Error) => {
                setError(err.message);
              });
            }}
          >
            <Input
              type="email"
              name="email"
              placeholder={t("auth.emailPlaceholder")}
              chamfer="dual"
              required
            />
            <Input
              type="password"
              name="password"
              placeholder={t("auth.passwordPlaceholder")}
              chamfer="dual"
              required
            />
            <Button
              variant="cyber"
              chamfer="dual"
              type="submit"
              className="w-full mt-2 cursor-pointer"
            >
              {effectiveFlow === "signIn" ? t("auth.signInBtn") : t("auth.signUpBtn")}
            </Button>
            {allowSignUps ? (
              <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 text-xs sm:text-sm items-center justify-center text-center">
                <span className="text-muted-foreground">
                  {effectiveFlow === "signIn"
                    ? t("auth.dontHaveAccount")
                    : t("auth.alreadyHaveAccount")}
                </span>
                <span
                  className="text-foreground underline hover:no-underline cursor-pointer font-medium"
                  onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
                >
                  {effectiveFlow === "signIn" ? t("auth.signUpInstead") : t("auth.signInInstead")}
                </span>
              </div>
            ) : (
              <div className="text-center text-xs text-muted-foreground pt-1">
                {t("auth.registrationsDisabled")}
              </div>
            )}
            {error && (
              <div className="bg-destructive/20 border border-destructive/50 rounded-none p-3 chamfer-dual">
                <p className="text-destructive-foreground font-mono text-xs">
                  {t("common.error")}: {error}
                </p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
