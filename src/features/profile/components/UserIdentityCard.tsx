import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
  Avatar,
  AvatarFallback,
} from "@boredkevin/ui";
import {
  User,
  Mail,
  Calendar,
  Hash,
  Edit3,
  Check,
  X,
  Copy,
  CheckCheck,
  Fingerprint,
  ShieldCheck,
} from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import { VerifyNisnModal } from "./VerifyNisnModal";

interface UserIdentityCardProps {
  user: {
    _id: Id<"users">;
    _creationTime: number;
    name?: string;
    email?: string;
    image?: string;
  };
}

export function UserIdentityCard({ user }: UserIdentityCardProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(user.name ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [isNisnModalOpen, setIsNisnModalOpen] = useState(false);

  const nisnStatus = useQuery(api.nisn.getStatus);
  const appSettings = useQuery(api.appSettings.get);
  const allowProfileNameChange = appSettings?.allowProfileNameChange !== false;
  const updateProfile = useMutation(api.users.updateProfile);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateProfile({ name: nameInput });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update profile", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(user._id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // clipboard fallback
    }
  };

  const initials = (user.name || user.email || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const formattedDate = new Date(user._creationTime).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Card telemetry="USER.PROFILE" cornerLines className="w-full bg-card/60 backdrop-blur-sm border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-none bg-primary/10 border border-primary/20 text-primary">
              <User className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">
                {t("profile.userIdentity")}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t("profile.userIdentityDesc")}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Avatar & Main Info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-none bg-background/50 border border-border/80">
          <Avatar className="w-16 h-16 rounded-none border border-primary/40 bg-primary/10 text-primary text-xl font-bold flex items-center justify-center">
            <AvatarFallback className="rounded-none bg-primary/10 text-primary font-mono font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 space-y-1">
            {isEditing ? (
              <form
                onSubmit={(e) => {
                  void handleSave(e);
                }}
                className="flex items-center gap-2 max-w-sm"
              >
                <Input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder={t("profile.displayName")}
                  chamfer="dual"
                  className="h-8 text-sm"
                  autoFocus
                  required
                />
                <Button
                  type="submit"
                  variant="cyber"
                  chamfer="dual"
                  size="sm"
                  disabled={isSaving}
                  className="h-8 px-2.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  chamfer="dual"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="h-8 px-2.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground truncate">
                  {user.name || t("profile.anonymousUser")}
                </h3>
                {!isEditing && allowProfileNameChange && (
                  <Button
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    onClick={() => {
                      setNameInput(user.name ?? "");
                      setIsEditing(true);
                    }}
                    className="text-xs flex items-center gap-1.5 h-8 px-2.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{t("common.edit")}</span>
                  </Button>
                )}
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{user.email || t("common.none")}</span>
            </div>
          </div>
        </div>

        {/* Account Metadata Details */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-muted/20 border border-border/60 flex flex-col gap-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5" /> {t("profile.uniqueUserId")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void handleCopyId();
                  }}
                  className="hover:text-foreground text-muted-foreground transition-colors cursor-pointer"
                  title={t("common.copy")}
                >
                  {copiedId ? (
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <span className="font-mono text-[11px] text-foreground truncate select-all">
                {user._id}
              </span>
            </div>

            <div className="p-3 bg-muted/20 border border-border/60 flex flex-col gap-1">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" /> {t("profile.accountCreated")}
              </span>
              <span className="font-medium text-foreground">
                {formattedDate}
              </span>
            </div>
          </div>

          {/* NISN Metadata Container */}
          {nisnStatus?.enabled !== false && (
            <div className="p-3 bg-muted/20 border border-border/60 flex items-center justify-between gap-3 text-xs">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Fingerprint className="w-3.5 h-3.5 text-primary" /> NISN
                </span>
                <span
                  className={`font-mono text-[11px] font-medium ${
                    nisnStatus?.isSet ? "text-emerald-400" : "text-amber-400/90"
                  }`}
                >
                  {nisnStatus?.isSet ? t("profile.nisnVerified") : t("profile.nisnNotVerified")}
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="dual"
                onClick={() => setIsNisnModalOpen(true)}
                className="text-xs h-7 px-3 cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{nisnStatus?.isSet ? t("profile.changeNisn") : t("profile.verifyNisn")}</span>
              </Button>
            </div>
          )}
        </div>

        <VerifyNisnModal
          isOpen={isNisnModalOpen}
          onClose={() => setIsNisnModalOpen(false)}
          isConfigured={nisnStatus?.isSet ?? false}
        />
      </CardContent>
    </Card>
  );
}
