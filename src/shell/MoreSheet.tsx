import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveWorkspace } from "../contexts";
import { usePermissions } from "../hooks/usePermissions";
import { LicensesModal } from "../components/layout/LicensesModal";
import { LanguageToggle, ThemeToggle } from "../components/common";
import { SignOutButton } from "../features/auth";
import { StatusPill } from "../ui";
import {
  X,
  Building2,
  Users,
  Shield,
  Link as LinkIcon,
  User,
  KeyRound,
  ShieldCheck,
  FileCode,
  ChevronRight,
} from "lucide-react";
import packageJson from "../../package.json";

export interface MoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MoreSheet({ isOpen, onClose }: MoreSheetProps) {
  const { t } = useTranslation();
  const [location] = useLocation();
  const [isLicensesOpen, setIsLicensesOpen] = useState(false);
  const { activeOrgId } = useActiveWorkspace();

  const orgs = useQuery(api.organizations.listMine);
  const activeOrg = orgs?.find((o) => o._id === activeOrgId) ?? orgs?.[0];
  const viewer = useQuery(api.users.viewer);

  const permissions = usePermissions(activeOrg?._id);
  const { canSign, canAdmin, canManageRoles, canViewInvites } = permissions;

  const userDisplayName =
    viewer?.name ||
    viewer?.email ||
    activeOrg?.name ||
    "Kasly Workspace";

  const avatarInitial = (
    viewer?.name ||
    viewer?.email ||
    activeOrg?.name ||
    "K"
  )
    .charAt(0)
    .toUpperCase();

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/75 modal-backdrop-animate"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Sheet / Modal Content */}
        <div
          className="relative z-10 w-full max-w-lg bg-card border-t sm:border border-border/80 rounded-t-[var(--fintech-radius-lg)] sm:rounded-[var(--fintech-radius-lg)] shadow-2xl overflow-hidden max-h-[88vh] flex flex-col modal-sheet-content"
          role="dialog"
          aria-modal="true"
          aria-labelledby="more-sheet-title"
        >
          {/* Mobile Sheet Pull Handle */}
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mt-2.5 -mb-1 shrink-0 sm:hidden" />
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/20 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-[var(--fintech-radius-sm)] bg-primary/10 border border-primary/25 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {avatarInitial}
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="more-sheet-title" className="text-sm font-semibold text-foreground truncate">
                  {userDisplayName}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <StatusPill tone={canAdmin ? "info" : canSign ? "success" : "neutral"} className="text-[10px] py-0 px-1.5 shrink-0">
                    {canAdmin ? "Admin" : canSign ? "Signer" : "Member"}
                  </StatusPill>
                  {activeOrg?.name && (
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 truncate max-w-[170px]">
                      <Building2 className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                      <span className="truncate">{activeOrg.name}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-[var(--fintech-radius-sm)] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer shrink-0 ml-2"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="p-4 space-y-5 overflow-y-auto overscroll-contain flex-1">
            {/* Treasury Tools (If user has sign/admin perms) */}
            {(canSign || canAdmin) && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono tracking-wider uppercase text-muted-foreground/80 px-2 font-medium">
                  {t("nav.treasury")}
                </span>
                <div className="space-y-1 bg-muted/20 p-1.5 rounded-[var(--fintech-radius-md)] border border-border/40">
                  {canSign && (
                    <Link
                      href="/treasury/bulk-dues"
                      onClick={onClose}
                      className={`flex items-center justify-between p-2.5 rounded-[var(--fintech-radius-sm)] text-xs font-medium transition-colors cursor-pointer ${
                        location === "/treasury/bulk-dues"
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Users className="w-4 h-4 text-primary" />
                        <span>{t("treasury.bulkDues.title", "Pencatatan Massal")}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                    </Link>
                  )}

                  {canSign && (
                    <Link
                      href="/treasury/keys"
                      onClick={onClose}
                      className={`flex items-center justify-between p-2.5 rounded-[var(--fintech-radius-sm)] text-xs font-medium transition-colors cursor-pointer ${
                        location === "/treasury/keys"
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <KeyRound className="w-4 h-4 text-primary" />
                        <span>{t("nav.myKeys")}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                    </Link>
                  )}

                  {canAdmin && (
                    <Link
                      href="/treasury/admin"
                      onClick={onClose}
                      className={`flex items-center justify-between p-2.5 rounded-[var(--fintech-radius-sm)] text-xs font-medium transition-colors cursor-pointer ${
                        location === "/treasury/admin"
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                        <span>{t("nav.adminPanel")}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Organization Section */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono tracking-wider uppercase text-muted-foreground/80 px-2 font-medium">
                {t("nav.organization")}
              </span>
              <div className="space-y-1 bg-muted/20 p-1.5 rounded-[var(--fintech-radius-md)] border border-border/40">
                <Link
                  href="/organization"
                  onClick={onClose}
                  className={`flex items-center justify-between p-2.5 rounded-[var(--fintech-radius-sm)] text-xs font-medium transition-colors cursor-pointer ${
                    location === "/organization"
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span>{t("nav.overview")}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                </Link>

                <Link
                  href="/organization/members"
                  onClick={onClose}
                  className={`flex items-center justify-between p-2.5 rounded-[var(--fintech-radius-sm)] text-xs font-medium transition-colors cursor-pointer ${
                    location === "/organization/members"
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>{t("nav.members")}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                </Link>

                {canManageRoles && (
                  <Link
                    href="/organization/roles"
                    onClick={onClose}
                    className={`flex items-center justify-between p-2.5 rounded-[var(--fintech-radius-sm)] text-xs font-medium transition-colors cursor-pointer ${
                      location === "/organization/roles"
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <span>{t("nav.roles")}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                  </Link>
                )}

                {canViewInvites && (
                  <Link
                    href="/organization/invites"
                    onClick={onClose}
                    className={`flex items-center justify-between p-2.5 rounded-[var(--fintech-radius-sm)] text-xs font-medium transition-colors cursor-pointer ${
                      location === "/organization/invites"
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <LinkIcon className="w-4 h-4 text-muted-foreground" />
                      <span>{t("nav.invites")}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                  </Link>
                )}
              </div>
            </div>

            {/* Account & App Section */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono tracking-wider uppercase text-muted-foreground/80 px-2 font-medium">
                {t("nav.userProfile")}
              </span>
              <div className="space-y-1 bg-muted/20 p-1.5 rounded-[var(--fintech-radius-md)] border border-border/40">
                <Link
                  href="/profile"
                  onClick={onClose}
                  className={`flex items-center justify-between p-2.5 rounded-[var(--fintech-radius-sm)] text-xs font-medium transition-colors cursor-pointer ${
                    location === "/profile"
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{t("nav.userProfile")}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                </Link>

                <div className="flex items-center justify-between p-2.5 rounded-[var(--fintech-radius-sm)] text-xs font-medium">
                  <span className="text-muted-foreground">{t("nav.theme", "Theme / Tampilan")}</span>
                  <ThemeToggle />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-[var(--fintech-radius-sm)] text-xs font-medium">
                  <span className="text-muted-foreground">Language / Bahasa</span>
                  <LanguageToggle />
                </div>

                <button
                  type="button"
                  onClick={() => setIsLicensesOpen(true)}
                  className="w-full flex items-center justify-between p-2.5 rounded-[var(--fintech-radius-sm)] text-xs font-medium text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <FileCode className="w-4 h-4 text-muted-foreground" />
                    <span>{t("nav.licenses", "Licenses & Legal")}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                </button>
              </div>
            </div>
          </div>

          {/* Footer Action: Logout button with version & build commit hash */}
          <div className="p-4 border-t border-border/60 bg-muted/10 shrink-0 flex items-center justify-between gap-3">
            <SignOutButton />
            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground shrink-0">
              <span>v{packageJson.version}</span>
              <span className="text-muted-foreground/40 select-none">•</span>
              <span className="px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono text-[11px] border border-border/40">
                {typeof __BUILD_HASH__ !== "undefined" ? __BUILD_HASH__ : "dev"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <LicensesModal isOpen={isLicensesOpen} onClose={() => setIsLicensesOpen(false)} />
    </>
  );
}
