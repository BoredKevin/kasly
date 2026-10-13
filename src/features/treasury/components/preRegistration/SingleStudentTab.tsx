import React from "react";
import { useTranslation } from "react-i18next";
import { Id, Doc } from "../../../../../convex/_generated/dataModel";
import { Button, Input, Badge } from "@boredkevin/ui";
import {
  Link,
  Copy,
  Check,
  MessageCircle,
  Share2,
  Coins,
} from "lucide-react";
import { getRegistrationUrl } from "./preRegistrationUtils";

export interface SingleStudentTabProps {
  singleName: string;
  setSingleName: (val: string) => void;
  singleNisn: string;
  setSingleNisn: (val: string) => void;
  singleBirthYear: string;
  setSingleBirthYear: (val: string) => void;
  singlePhone: string;
  setSinglePhone: (val: string) => void;
  singleDuesCount: number;
  setSingleDuesCount: (val: number) => void;
  selectedFundId: Id<"funds"> | null;
  setSelectedFundId: (val: Id<"funds">) => void;
  activeFunds: Doc<"funds">[];
  currentFund?: Doc<"funds">;
  duesEvents?: Array<{ amount: number }>;
  availableEventsCount: number;
  isSubmittingSingle: boolean;
  onSubmit: (e: React.FormEvent) => void;
  lastAddedStudent: {
    name: string;
    token: string;
    phone: string;
  } | null;
  copiedId: string | null;
  onCopyLink: (token: string, identifier: string) => void;
  onCopyWhatsApp: (studentName: string, token: string, identifier: string) => void;
  onOpenWhatsApp: (studentName: string, token: string, phone?: string) => void;
}

export function SingleStudentTab({
  singleName,
  setSingleName,
  singleNisn,
  setSingleNisn,
  singleBirthYear,
  setSingleBirthYear,
  singlePhone,
  setSinglePhone,
  singleDuesCount,
  setSingleDuesCount,
  selectedFundId,
  setSelectedFundId,
  activeFunds,
  currentFund,
  duesEvents,
  availableEventsCount,
  isSubmittingSingle,
  onSubmit,
  lastAddedStudent,
  copiedId,
  onCopyLink,
  onCopyWhatsApp,
  onOpenWhatsApp,
}: SingleStudentTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 max-w-lg mx-auto py-2">
      {/* Last Added Student Registration Link Card */}
      {lastAddedStudent && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 chamfer-dual space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5" />
              {t("treasury.preReg.singleLinkCreated")}: {lastAddedStudent.name}
            </span>
            <Badge variant="secondary" className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300">
              READY TO SEND
            </Badge>
          </div>

          <div className="p-2 bg-background/70 border border-border/60 text-xs font-mono text-foreground truncate select-all">
            {getRegistrationUrl(lastAddedStudent.token)}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="cyber"
              size="sm"
              chamfer="none"
              onClick={() => onCopyLink(lastAddedStudent.token, "single_post")}
              className="text-xs h-7 cursor-pointer flex items-center gap-1"
            >
              {copiedId === "link_single_post" ? (
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
                  lastAddedStudent.name,
                  lastAddedStudent.token,
                  "single_post",
                )
              }
              className="text-xs h-7 cursor-pointer flex items-center gap-1"
            >
              {copiedId === "wa_single_post" ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>{t("treasury.preReg.waCopied")}</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-3 h-3 text-emerald-400" />
                  <span>{t("treasury.preReg.copyWa")}</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="none"
              onClick={() =>
                onOpenWhatsApp(
                  lastAddedStudent.name,
                  lastAddedStudent.token,
                  lastAddedStudent.phone,
                )
              }
              className="text-xs h-7 cursor-pointer flex items-center gap-1 text-emerald-400 hover:bg-emerald-500/10"
            >
              <Share2 className="w-3 h-3" />
              <span>{t("treasury.preReg.openWa")}</span>
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            {t("treasury.preReg.studentName")}
          </label>
          <Input
            type="text"
            value={singleName}
            onChange={(e) => setSingleName(e.target.value)}
            placeholder="e.g. Kevin Sanjaya"
            chamfer="none"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              {t("treasury.preReg.nisn")}
            </label>
            <Input
              type="text"
              value={singleNisn}
              onChange={(e) => setSingleNisn(e.target.value)}
              placeholder="10 numeric digits"
              maxLength={10}
              chamfer="none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              {t("treasury.preReg.birthYear")}
            </label>
            <Input
              type="text"
              value={singleBirthYear}
              onChange={(e) => setSingleBirthYear(e.target.value)}
              placeholder="e.g. 2008"
              maxLength={4}
              chamfer="none"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            {t("treasury.preReg.phone")}
          </label>
          <Input
            type="tel"
            value={singlePhone}
            onChange={(e) => setSinglePhone(e.target.value)}
            placeholder="e.g. 08123456789"
            chamfer="none"
            required
          />
        </div>

        {/* DUES ASSIGNMENT SECTION */}
        <div className="p-3.5 bg-muted/30 border border-border/80 space-y-3 chamfer-dual mt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-primary" />
              {t("treasury.preReg.assignPastDues")}
            </span>
            {availableEventsCount > 0 ? (
              <Badge variant="outline" className="text-[10px] font-mono">
                {availableEventsCount} {t("treasury.preReg.nCycles", { count: availableEventsCount })} available
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                0 cycles
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                {t("treasury.preReg.targetFund")}
              </label>
              <select
                value={selectedFundId ?? ""}
                onChange={(e) => setSelectedFundId(e.target.value as Id<"funds">)}
                className="w-full h-8 px-2 bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary cursor-pointer"
              >
                {activeFunds.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name} ({f.currency})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                {t("treasury.preReg.assignPastDues")}
              </label>
              <select
                value={singleDuesCount}
                onChange={(e) => setSingleDuesCount(parseInt(e.target.value, 10))}
                disabled={availableEventsCount === 0}
                className="w-full h-8 px-2 bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50"
              >
                <option value={0}>{t("treasury.preReg.noPastDues")}</option>
                {availableEventsCount >= 1 && <option value={1}>{t("treasury.preReg.oneCycle")}</option>}
                {availableEventsCount >= 2 && <option value={2}>{t("treasury.preReg.nCycles", { count: 2 })}</option>}
                {availableEventsCount >= 3 && <option value={3}>{t("treasury.preReg.nCycles", { count: 3 })}</option>}
                {availableEventsCount >= 4 && <option value={4}>{t("treasury.preReg.nCycles", { count: 4 })}</option>}
                {availableEventsCount >= 5 && <option value={5}>{t("treasury.preReg.nCycles", { count: 5 })}</option>}
                {availableEventsCount > 0 && (
                  <option value={availableEventsCount}>
                    {t("treasury.preReg.allCycles", { count: availableEventsCount })}
                  </option>
                )}
              </select>
            </div>
          </div>

          {singleDuesCount > 0 && duesEvents && (
            <div className="p-2 bg-primary/10 border border-primary/30 text-[11px] font-mono text-primary flex items-center justify-between">
              <span>
                {t("treasury.preReg.duesPreview", {
                  count: Math.min(singleDuesCount, availableEventsCount),
                  amount: `${currentFund?.currency || "IDR"} ${(
                    duesEvents
                      .slice(0, singleDuesCount)
                      .reduce((sum, ev) => sum + ev.amount, 0)
                  ).toLocaleString()}`,
                })}
              </span>
            </div>
          )}
        </div>

        <Button
          type="submit"
          variant="cyber"
          chamfer="none"
          disabled={isSubmittingSingle}
          className="w-full mt-3 cursor-pointer"
        >
          {isSubmittingSingle
            ? t("treasury.preReg.adding")
            : t("treasury.preReg.addStudentBtn")}
        </Button>
      </form>
    </div>
  );
}
