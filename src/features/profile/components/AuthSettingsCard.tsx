import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Badge,
} from "@boredkevin/ui";
import {
  ShieldCheck,
  KeyRound,
  Mail,
  Check,
  AlertCircle,
  Lock,
} from "lucide-react";

interface AuthSettingsCardProps {
  email?: string;
}

export function AuthSettingsCard({ email }: AuthSettingsCardProps) {
  // Email change state
  const [emailInput, setEmailInput] = useState(email ?? "");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const changeEmailMutation = useMutation(api.users.changeEmail);
  const changePasswordAction = useAction(api.users.changePassword);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setIsUpdatingEmail(true);
    setEmailSuccess(null);
    setEmailError(null);

    try {
      await changeEmailMutation({ newEmail: emailInput.trim() });
      setEmailSuccess("Email address updated successfully.");
      setTimeout(() => setEmailSuccess(null), 3000);
    } catch (err: unknown) {
      setEmailError(
        err instanceof Error ? err.message : "Failed to update email address.",
      );
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;

    setIsChangingPassword(true);
    setPasswordSuccess(null);
    setPasswordError(null);

    try {
      await changePasswordAction({
        currentPassword,
        newPassword,
      });
      setPasswordSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err: unknown) {
      setPasswordError(
        err instanceof Error ? err.message : "Failed to change password.",
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <Card telemetry="USER.AUTH" cornerLines className="w-full bg-card/60 backdrop-blur-sm border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-none bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">
                Authentication & Security
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Manage your credentials, login email, and account password
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Change Email Section */}
        <div className="p-3.5 bg-background/50 border border-border/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">
                Account Email
              </span>
            </div>
            <Badge variant="secondary" className="text-[10px] font-mono">
              PRIMARY
            </Badge>
          </div>

          <form
            onSubmit={(e) => {
              void handleUpdateEmail(e);
            }}
            className="space-y-2"
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                placeholder="Account email address"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                chamfer="dual"
                className="text-xs h-8"
                required
              />
              <Button
                type="submit"
                variant="cyber"
                chamfer="dual"
                size="sm"
                disabled={isUpdatingEmail || !emailInput || emailInput === email}
                className="h-8 px-3 text-xs shrink-0 cursor-pointer"
              >
                {isUpdatingEmail ? "Saving..." : "Change Email"}
              </Button>
            </div>

            {emailSuccess && (
              <p className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{emailSuccess}</span>
              </p>
            )}
            {emailError && (
              <p className="text-[11px] text-destructive font-mono flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{emailError}</span>
              </p>
            )}
          </form>
        </div>

        {/* Change Password Section */}
        <div className="p-3.5 bg-background/50 border border-border/80 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">
              Change Password
            </span>
          </div>

          <form
            onSubmit={(e) => {
              void handleChangePassword(e);
            }}
            className="space-y-2.5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <Input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  chamfer="dual"
                  className="text-xs h-8 pr-7"
                  required
                />
                <Lock className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground pointer-events-none" />
              </div>

              <div className="relative">
                <Input
                  type="password"
                  placeholder="New password (min 8 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  chamfer="dual"
                  className="text-xs h-8 pr-7"
                  required
                />
                <Lock className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <div className="flex-1 min-w-0">
                {passwordSuccess && (
                  <p className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>{passwordSuccess}</span>
                  </p>
                )}
                {passwordError && (
                  <p className="text-[11px] text-destructive font-mono flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{passwordError}</span>
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="cyber"
                chamfer="dual"
                size="sm"
                disabled={isChangingPassword || !currentPassword || !newPassword}
                className="h-8 px-3 text-xs shrink-0 self-end sm:self-auto"
              >
                {isChangingPassword ? "Updating..." : "Change Password"}
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
