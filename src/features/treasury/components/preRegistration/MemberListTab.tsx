import { useTranslation } from "react-i18next";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Button, Badge } from "@boredkevin/ui";
import {
  Download,
  Copy,
  Check,
  MessageCircle,
  ExternalLink,
  RefreshCw,
  Coins,
  Trash2,
} from "lucide-react";

export interface PlaceholderMemberItem {
  memberId: string;
  userId: Id<"users">;
  name: string;
  registrationToken?: string;
  unpaidCyclesCount: number;
  unpaidAmount: number;
}

export interface MemberListTabProps {
  placeholderMembers?: PlaceholderMemberItem[];
  onExportCsv: () => void;
  copiedId: string | null;
  onCopyLink: (token: string, identifier: string) => void;
  onCopyWhatsApp: (name: string, token: string, identifier: string) => void;
  onOpenWhatsApp: (name: string, token: string) => void;
  onRegenerateLink: (userId: Id<"users">, name: string) => void;
  onAdjustDues: (user: { userId: Id<"users">; name: string }) => void;
  onDeletePlaceholder: (userId: Id<"users">) => void;
}

export function MemberListTab({
  placeholderMembers,
  onExportCsv,
  copiedId,
  onCopyLink,
  onCopyWhatsApp,
  onOpenWhatsApp,
  onRegenerateLink,
  onAdjustDues,
  onDeletePlaceholder,
}: MemberListTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 py-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-xs font-mono text-muted-foreground">
          Unclaimed Records: <strong>{placeholderMembers?.length ?? 0}</strong>
        </span>

        {placeholderMembers && placeholderMembers.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            chamfer="none"
            onClick={onExportCsv}
            className="text-xs cursor-pointer flex items-center gap-1.5 h-7"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t("treasury.preReg.exportLinksCsv")}</span>
          </Button>
        )}
      </div>

      {placeholderMembers === undefined ? (
        <div className="py-8 text-center text-xs font-mono text-muted-foreground animate-pulse">
          {t("common.loading")}
        </div>
      ) : placeholderMembers.length === 0 ? (
        <div className="py-8 text-center text-xs font-mono text-muted-foreground">
          {t("treasury.preReg.noPlaceholders")}
        </div>
      ) : (
        <div className="border border-border/60 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] font-mono text-muted-foreground uppercase border-b border-border/60">
              <tr>
                <th className="p-2.5 text-left">Student Name</th>
                <th className="p-2.5 text-left">Registration Link</th>
                <th className="p-2.5 text-left">Unpaid Dues</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {placeholderMembers.map((member) => (
                <tr key={member.memberId} className="hover:bg-muted/20 transition-colors">
                  <td className="p-2.5 font-semibold text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{member.name}</span>
                      <Badge
                        variant="outline"
                        className="text-[8px] px-1 py-0 border-amber-500/40 text-amber-300 bg-amber-500/10 font-bold"
                      >
                        UNCLAIMED
                      </Badge>
                    </div>
                  </td>

                  <td className="p-2.5">
                    {member.registrationToken ? (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          chamfer="none"
                          onClick={() =>
                            onCopyLink(
                              member.registrationToken!,
                              member.memberId,
                            )
                          }
                          className="h-6 text-[10px] px-2 cursor-pointer flex items-center gap-1"
                        >
                          {copiedId === `link_${member.memberId}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>{t("treasury.preReg.linkCopied")}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>{t("treasury.preReg.copyLink")}</span>
                            </>
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          chamfer="none"
                          onClick={() =>
                            onCopyWhatsApp(
                              member.name,
                              member.registrationToken!,
                              member.memberId,
                            )
                          }
                          className="h-6 text-[10px] px-1.5 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                          title={t("treasury.preReg.copyWa")}
                        >
                          {copiedId === `wa_${member.memberId}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <MessageCircle className="w-3 h-3" />
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          chamfer="none"
                          onClick={() =>
                            onOpenWhatsApp(
                              member.name,
                              member.registrationToken!,
                            )
                          }
                          className="h-6 text-[10px] px-1.5 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                          title={t("treasury.preReg.openWa")}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>

                        <button
                          type="button"
                          onClick={() =>
                            onRegenerateLink(
                              member.userId,
                              member.name,
                            )
                          }
                          className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors cursor-pointer ml-1"
                          title={t("treasury.preReg.regenerateLink")}
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[10px]">No token</span>
                    )}
                  </td>

                  <td className="p-2.5">
                    {member.unpaidCyclesCount > 0 ? (
                      <span className="text-amber-400 font-bold">
                        {member.unpaidCyclesCount} cycles (Rp{" "}
                        {member.unpaidAmount.toLocaleString()})
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0 cycles</span>
                    )}
                  </td>

                  <td className="p-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        chamfer="none"
                        onClick={() =>
                          onAdjustDues({
                            userId: member.userId,
                            name: member.name,
                          })
                        }
                        className="h-6 text-[10px] px-2 text-primary hover:bg-primary/10 cursor-pointer flex items-center gap-1"
                      >
                        <Coins className="w-3 h-3" />
                        <span>{t("treasury.preReg.adjustDuesBtn")}</span>
                      </Button>

                      <button
                        type="button"
                        onClick={() => onDeletePlaceholder(member.userId)}
                        className="text-destructive hover:bg-destructive/15 p-1 rounded transition-colors cursor-pointer"
                        title="Delete placeholder student"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
