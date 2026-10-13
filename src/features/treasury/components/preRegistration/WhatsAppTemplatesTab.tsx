import { useTranslation } from "react-i18next";
import { Button, Badge } from "@boredkevin/ui";
import { MessageCircle } from "lucide-react";

export interface WhatsAppTemplatesTabProps {
  activeTemplatePreset: "standard" | "short" | "english" | "custom";
  setActiveTemplatePreset: (preset: "standard" | "short" | "english" | "custom") => void;
  customTemplateText: string;
  setCustomTemplateText: (val: string) => void;
  orgName: string;
  formatWhatsAppMessage: (studentName: string, token: string) => string;
}

export function WhatsAppTemplatesTab({
  activeTemplatePreset,
  setActiveTemplatePreset,
  customTemplateText,
  setCustomTemplateText,
  orgName,
  formatWhatsAppMessage,
}: WhatsAppTemplatesTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 py-2 max-w-lg mx-auto">
      <div className="space-y-1">
        <label className="text-xs font-semibold text-foreground">
          {t("treasury.preReg.waTemplateSection")}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button
            type="button"
            variant={activeTemplatePreset === "standard" ? "cyber" : "outline"}
            size="sm"
            chamfer="none"
            onClick={() => setActiveTemplatePreset("standard")}
            className="text-xs h-7 cursor-pointer"
          >
            Standard
          </Button>
          <Button
            type="button"
            variant={activeTemplatePreset === "short" ? "cyber" : "outline"}
            size="sm"
            chamfer="none"
            onClick={() => setActiveTemplatePreset("short")}
            className="text-xs h-7 cursor-pointer"
          >
            Short
          </Button>
          <Button
            type="button"
            variant={activeTemplatePreset === "english" ? "cyber" : "outline"}
            size="sm"
            chamfer="none"
            onClick={() => setActiveTemplatePreset("english")}
            className="text-xs h-7 cursor-pointer"
          >
            English
          </Button>
          <Button
            type="button"
            variant={activeTemplatePreset === "custom" ? "cyber" : "outline"}
            size="sm"
            chamfer="none"
            onClick={() => setActiveTemplatePreset("custom")}
            className="text-xs h-7 cursor-pointer"
          >
            Custom
          </Button>
        </div>
      </div>

      {activeTemplatePreset === "custom" && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Custom Template Text
          </label>
          <textarea
            rows={6}
            value={customTemplateText}
            onChange={(e) => setCustomTemplateText(e.target.value)}
            placeholder="Enter custom template..."
            className="w-full p-2.5 bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary chamfer-dual"
          />
          <p className="text-[10px] text-muted-foreground font-mono">
            {t("treasury.preReg.placeholdersHelp")}
          </p>
        </div>
      )}

      {/* Live Preview */}
      <div className="p-3.5 bg-muted/20 border border-border/80 space-y-2 chamfer-dual">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span>{t("treasury.preReg.waPreview")}</span>
          </span>
          <Badge variant="outline" className="text-[9px] font-mono">
            Target Org: {orgName}
          </Badge>
        </div>

        <div className="p-3 bg-background border border-border/60 text-xs font-mono text-foreground whitespace-pre-line select-all leading-relaxed">
          {formatWhatsAppMessage("Kevin Sanjaya", "sample_token_xyz123")}
        </div>
      </div>
    </div>
  );
}
