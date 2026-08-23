import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
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
                ? "Sign in to your account"
                : "Create your Kasly account"}
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
              placeholder="Email"
              chamfer="dual"
              required
            />
            <Input
              type="password"
              name="password"
              placeholder="Password"
              chamfer="dual"
              required
            />
            <Button
              variant="cyber"
              chamfer="dual"
              type="submit"
              className="w-full mt-2 cursor-pointer"
            >
              {effectiveFlow === "signIn" ? "Sign in" : "Sign up"}
            </Button>
            {allowSignUps ? (
              <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 text-xs sm:text-sm items-center justify-center text-center">
                <span className="text-muted-foreground">
                  {effectiveFlow === "signIn"
                    ? "Don't have an account?"
                    : "Already have an account?"}
                </span>
                <span
                  className="text-foreground underline hover:no-underline cursor-pointer font-medium"
                  onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
                >
                  {effectiveFlow === "signIn" ? "Sign up instead" : "Sign in instead"}
                </span>
              </div>
            ) : (
              <div className="text-center text-xs text-muted-foreground pt-1">
                New user registrations are currently disabled.
              </div>
            )}
            {error && (
              <div className="bg-destructive/20 border border-destructive/50 rounded-none p-3 chamfer-dual">
                <p className="text-destructive-foreground font-mono text-xs">
                  Error: {error}
                </p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
