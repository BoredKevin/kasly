import { useTranslation } from "react-i18next";
import { Button, Input, Badge } from "@boredkevin/ui";
import {
  CreditCard,
  QrCode,
  RefreshCw,
  ExternalLink,
  KeyRound,
  ChevronDown,
  ChevronUp,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Webhook,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";

export interface GatewayCredentialsSectionProps {
  credentialTab: "borderpay" | "temanqris";
  setCredentialTab: (tab: "borderpay" | "temanqris") => void;
  config: any;
  isFetching: boolean;
  onFetchMethods: () => void;
  isEditingCredentials: boolean;
  setIsEditingCredentials: (val: boolean) => void;
  apiKey: string;
  setApiKey: (val: string) => void;
  webhookToken: string;
  setWebhookToken: (val: string) => void;
  temanQrisApiKey: string;
  setTemanQrisApiKey: (val: string) => void;
  temanQrisWebhookSecret: string;
  setTemanQrisWebhookSecret: (val: string) => void;
  activeWebhookUrl: string;
  isCopied: boolean;
  onCopyWebhookUrl: () => void;
}

export function GatewayCredentialsSection({
  credentialTab,
  setCredentialTab,
  config,
  isFetching,
  onFetchMethods,
  isEditingCredentials,
  setIsEditingCredentials,
  apiKey,
  setApiKey,
  webhookToken,
  setWebhookToken,
  temanQrisApiKey,
  setTemanQrisApiKey,
  temanQrisWebhookSecret,
  setTemanQrisWebhookSecret,
  activeWebhookUrl,
  isCopied,
  onCopyWebhookUrl,
}: GatewayCredentialsSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="border border-border/80 bg-muted/10 p-4 space-y-4">
      {/* Provider Tabs Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-1 bg-muted/30 p-1 border border-border/60">
          <button
            type="button"
            onClick={() => setCredentialTab("borderpay")}
            className={`px-3 py-1.5 text-xs font-mono font-medium flex items-center gap-2 transition-colors cursor-pointer ${
              credentialTab === "borderpay"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-primary" />
            <span>BorderPay</span>
            {config?.hasApiKey ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400" title="Connected" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400/60" title="Not Configured" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setCredentialTab("temanqris")}
            className={`px-3 py-1.5 text-xs font-mono font-medium flex items-center gap-2 transition-colors cursor-pointer ${
              credentialTab === "temanqris"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-primary" />
            <span>TemanQRIS</span>
            {config?.providerConfigs?.temanqris?.hasApiKey ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400" title="Connected" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400/60" title="Not Configured" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {credentialTab === "borderpay" && config?.hasApiKey && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="none"
              disabled={isFetching}
              onClick={onFetchMethods}
              className="h-8 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              <span>{isFetching ? t("treasury.gateway.fetching") : t("treasury.gateway.fetchLiveMethods")}</span>
            </Button>
          )}

          {credentialTab === "temanqris" && (
            <a
              href="https://temanqris.com"
              target="_blank"
              rel="noreferrer"
              className="h-8 px-2.5 text-xs font-mono text-muted-foreground hover:text-primary flex items-center gap-1.5 border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>temanqris.com</span>
            </a>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsEditingCredentials(!isEditingCredentials)}
            className="h-8 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 border border-border/60"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>
              {isEditingCredentials
                ? t("treasury.gateway.hideCredentials")
                : t("treasury.gateway.editCredentials")}
            </span>
            {isEditingCredentials ? (
              <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Provider Summary Row */}
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
          {credentialTab === "borderpay" ? <Settings2 className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              {credentialTab === "borderpay"
                ? "BorderPay Gateway (Aggregator)"
                : "TemanQRIS (Direct Static-to-Dynamic Rail)"}
            </span>
            {(credentialTab === "borderpay"
              ? config?.hasApiKey
              : config?.providerConfigs?.temanqris?.hasApiKey) ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                {t("treasury.gateway.connectedStatus")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 border border-amber-500/20">
                <AlertCircle className="w-3 h-3" />
                {t("treasury.gateway.notConnectedStatus")}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {credentialTab === "borderpay"
              ? t("treasury.gateway.gatewaySettingsSubtitle")
              : t("treasury.gateway.temanqrisSubtitle", "Direct static-to-dynamic QRIS converter with 0% transaction fee.")}
          </p>
        </div>
      </div>

      {/* Collapsible Credentials & Webhook Form */}
      {isEditingCredentials && (
        <div className="pt-4 border-t border-border/60 space-y-4 animate-in fade-in-50 duration-150">
          {credentialTab === "borderpay" ? (
            /* BorderPay Credentials */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* API Key */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="gateway-api-key"
                    className="text-xs font-medium text-foreground flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-primary" />
                      {t("treasury.gateway.apiKey")}
                    </span>
                    {config?.maskedApiKey && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        Current: {config.maskedApiKey}
                      </span>
                    )}
                  </label>
                  <Input
                    id="gateway-api-key"
                    type="password"
                    chamfer="none"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      config?.hasApiKey
                        ? "Leave blank to keep current key"
                        : t("treasury.gateway.apiKeyPlaceholder")
                    }
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {t("treasury.gateway.apiKeyHelp")}
                  </p>
                </div>

                {/* Webhook Token */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="gateway-webhook-token"
                    className="text-xs font-medium text-foreground flex items-center gap-1.5"
                  >
                    <Webhook className="w-3.5 h-3.5 text-primary" />
                    {t("treasury.gateway.webhookToken")}
                  </label>
                  <Input
                    id="gateway-webhook-token"
                    type="text"
                    chamfer="none"
                    value={webhookToken}
                    onChange={(e) => setWebhookToken(e.target.value)}
                    placeholder={t("treasury.gateway.webhookTokenPlaceholder")}
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {t("treasury.gateway.webhookTokenHelp")}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* TemanQRIS Credentials */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* API Key */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="temanqris-api-key"
                    className="text-xs font-medium text-foreground flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-primary" />
                      TemanQRIS API Key (X-API-Key)
                    </span>
                    {config?.providerConfigs?.temanqris?.maskedApiKey && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        Current: {config.providerConfigs.temanqris.maskedApiKey}
                      </span>
                    )}
                  </label>
                  <Input
                    id="temanqris-api-key"
                    type="password"
                    chamfer="none"
                    value={temanQrisApiKey}
                    onChange={(e) => setTemanQrisApiKey(e.target.value)}
                    placeholder={
                      config?.providerConfigs?.temanqris?.hasApiKey
                        ? "Leave blank to keep current key"
                        : "tq_live_..."
                    }
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {t(
                      "treasury.gateway.temanqrisApiKeyHelp",
                      "Get your API key from the TemanQRIS Dashboard under Settings > API."
                    )}
                  </p>
                </div>

                {/* Webhook Secret */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="temanqris-webhook-secret"
                    className="text-xs font-medium text-foreground flex items-center gap-1.5"
                  >
                    <Webhook className="w-3.5 h-3.5 text-primary" />
                    Webhook Secret (HMAC-SHA256)
                  </label>
                  <Input
                    id="temanqris-webhook-secret"
                    type="text"
                    chamfer="none"
                    value={temanQrisWebhookSecret}
                    onChange={(e) => setTemanQrisWebhookSecret(e.target.value)}
                    placeholder="whsec_... or secret string"
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {t(
                      "treasury.gateway.temanqrisSecretHelp",
                      "Shared secret used to verify the X-TemanQRIS-Signature header."
                    )}
                  </p>
                </div>
              </div>

              <div className="p-2.5 bg-primary/5 border border-primary/20 text-xs font-mono text-muted-foreground">
                💡 {t(
                  "treasury.gateway.temanqrisStaticNotice",
                  "Make sure your Static QRIS image is uploaded and active on temanqris.com so dynamic orders can be generated seamlessly."
                )}
              </div>
            </div>
          )}

          {/* Target Webhook URL Banner */}
          <div className="p-3 bg-black/40 border border-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Webhook className="w-3.5 h-3.5 text-primary" />
                {t("treasury.gateway.webhookUrl")} ({credentialTab === "temanqris" ? "TemanQRIS" : "BorderPay"})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="none"
                onClick={onCopyWebhookUrl}
                className="h-7 text-xs flex items-center gap-1"
              >
                {isCopied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{isCopied ? t("common.copied") : t("common.copy")}</span>
              </Button>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground bg-black/60 p-2 border border-border/40 select-all break-all">
              {activeWebhookUrl}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {credentialTab === "temanqris"
                ? t(
                    "treasury.gateway.temanqrisWebhookHelp",
                    "Paste this webhook endpoint into your TemanQRIS dashboard webhook settings."
                  )
                : t("treasury.gateway.webhookUrlHelp")}
            </p>
          </div>

          {/* Signing Key Status */}
          {config?.gatewayKeyId && (
            <div className="p-2.5 bg-emerald-500/[0.04] border border-emerald-500/20 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-[11px] text-emerald-300">
                  {t("treasury.gateway.signingKeyTitle")}:
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  ECDSA P-256 Registered
                </span>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] border-emerald-500/30 text-emerald-400">
                KEY ID: {config.gatewayKeyId}
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
