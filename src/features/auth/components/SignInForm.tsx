import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
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

  return (
    <div className="flex flex-col gap-8 w-96 mx-auto">
      <Card telemetry="AUTH.01" cornerLines={true} className="w-full">
        <CardHeader>
          <CardTitle className="text-base font-normal">
            <p>Log in to see the numbers</p>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              formData.set("flow", flow);
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
              className="w-full mt-2"
            >
              {flow === "signIn" ? "Sign in" : "Sign up"}
            </Button>
            <div className="flex flex-row gap-2 text-sm justify-center">
              <span className="text-muted-foreground">
                {flow === "signIn"
                  ? "Don't have an account?"
                  : "Already have an account?"}
              </span>
              <span
                className="text-foreground underline hover:no-underline cursor-pointer font-medium"
                onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
              >
                {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
              </span>
            </div>
            {error && (
              <div className="bg-destructive/20 border border-destructive/50 rounded-none p-3 chamfer-dual">
                <p className="text-destructive-foreground font-mono text-xs">
                  Error signing in: {error}
                </p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
