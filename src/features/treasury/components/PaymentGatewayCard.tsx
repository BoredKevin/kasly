import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Input,
  Badge,
  Switch,
} from "@boredkevin/ui";
import {
  CreditCard,
  KeyRound,
  Webhook,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  QrCode,
  Building,
  Wallet,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Settings2,
  CheckCircle2,
  Layers,
  ExternalLink,
  Coins,
} from "lucide-react";

interface PaymentGatewayCardProps {
  organizationId: Id<"organizations">;
}

interface GatewayOption {
  id: string;
  name: string;
  supportedChannels?: readonly string[] | string[];
}

export function PaymentGatewayCard({ organizationId }: PaymentGatewayCardProps) {
  const { t } = useTranslation();

  const config = useQuery(api.treasury.gateways.router.getPaymentConfig, { organizationId });
  const availableGateways = useQuery(api.treasury.gateways.router.listAvailableGateways);
  const saveConfig = useAction(api.treasury.gateways.router.savePaymentConfig);
  const fetchMethods = useAction(api.treasury.gateways.router.fetchAvailablePaymentMethods);

  // Active Provider Tab in Credentials Section
  const [credentialTab, setCredentialTab] = useState<"borderpay" | "temanqris">("borderpay");

  // BorderPay Credentials
  const [apiKey, setApiKey] = useState("");
  const [webhookToken, setWebhookToken] = useState("");

  // TemanQRIS Credentials
  const [temanQrisApiKey, setTemanQrisApiKey] = useState("");
  const [temanQrisWebhookSecret, setTemanQrisWebhookSecret] = useState("");

  // Global Gateway Master Enable
  const [isEnabled, setIsEnabled] = useState(false);

  // Method Rail Toggles
  const [qrisEnabled, setQrisEnabled] = useState(true);
  const [vaEnabled, setVaEnabled] = useState(true);
  const [ewalletEnabled, setEwalletEnabled] = useState(true);

  // Gateway Routing Assignments
  const [qrisGateway, setQrisGateway] = useState("borderpay");
  const [vaGateway, setVaGateway] = useState("borderpay");
  const [ewalletGateway, setEwalletGateway] = useState("borderpay");

  // Custom QRIS Surcharge Settings (especially for TemanQRIS)
  const [customQrisFeeType, setCustomQrisFeeType] = useState<"flat" | "percent">("flat");
  const [customQrisFeeValue, setCustomQrisFeeValue] = useState<number>(0);

  // Custom QRIS Display Name (Printed on QRIS Header)
  const [qrisName, setQrisName] = useState("");

  // Specific Bank & Wallet Selections
  const standardBanks = [
    { code: "BCA", name: "BCA" },
    { code: "BNI", name: "BNI" },
    { code: "MANDIRI", name: "Mandiri" },
    { code: "BRI", name: "BRI" },
    { code: "PERMATA", name: "Permata" },
    { code: "CIMB", name: "CIMB Niaga" },
  ];

  const standardWallets = [
    { code: "DANA", name: "DANA" },
    { code: "SHOPEE", name: "ShopeePay" },
    { code: "OVO", name: "OVO" },
  ];

  const [enabledBanks, setEnabledBanks] = useState<string[]>([
    "BCA",
    "BNI",
    "MANDIRI",
    "BRI",
    "PERMATA",
    "CIMB",
  ]);
  const [enabledWallets, setEnabledWallets] = useState<string[]>([
    "DANA",
    "SHOPEE",
    "OVO",
  ]);

  // Progressive Disclosure Toggles
  const [isEditingCredentials, setIsEditingCredentials] = useState(false);
  const [isCustomizingBanks, setIsCustomizingBanks] = useState(false);
  const [isCustomizingWallets, setIsCustomizingWallets] = useState(false);

  // Feedback & Action States
  const [isCopied, setIsCopied] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [hasInitialized, setHasInitialized] = useState(false);

  // Synchronize state when config query resolves
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (config && !hasInitialized) {
      setIsEnabled(config.isEnabled);
      setWebhookToken(config.webhookToken || "");
      if (config.methodOverrides) {
        setQrisEnabled(config.methodOverrides.qrisEnabled);
        setEnabledBanks(config.methodOverrides.enabledBanks);
        setVaEnabled(
          config.methodOverrides.vaEnabled !== undefined
            ? config.methodOverrides.vaEnabled
            : config.methodOverrides.enabledBanks.length > 0
        );
        setEnabledWallets(config.methodOverrides.enabledWallets);
        setEwalletEnabled(
          config.methodOverrides.ewalletEnabled !== undefined
            ? config.methodOverrides.ewalletEnabled
            : config.methodOverrides.enabledWallets.length > 0
        );
        if (config.methodOverrides.customQrisFee) {
          setCustomQrisFeeType(config.methodOverrides.customQrisFee.type);
          setCustomQrisFeeValue(config.methodOverrides.customQrisFee.value);
        }
      }
      if (config.channelRouting) {
        setQrisGateway(config.channelRouting.qrisGateway || "borderpay");
        setVaGateway(config.channelRouting.vaGateway || "borderpay");
        setEwalletGateway(config.channelRouting.ewalletGateway || "borderpay");
      }
      if (config.providerConfigs?.temanqris) {
        setTemanQrisWebhookSecret(config.providerConfigs.temanqris.webhookToken || "");
      }
      // Auto-expand credentials if neither provider is set up yet
      if (!config.hasApiKey && !config.providerConfigs?.temanqris?.hasApiKey) {
        setIsEditingCredentials(true);
      }
      if (config.qrisName !== undefined) {
        setQrisName(config.qrisName);
      }
      setHasInitialized(true);
    }
  }, [config, hasInitialized]);

  // Webhook URL derivation
  const rawSiteUrl =
    (import.meta.env.VITE_CONVEX_SITE_URL as string | undefined) ||
    (import.meta.env.VITE_CONVEX_URL
      ? (import.meta.env.VITE_CONVEX_URL as string).replace(/\.convex\.cloud\/?$/, ".convex.site")
      : "");
  const cleanSiteUrl = rawSiteUrl ? rawSiteUrl.replace(/\/+$/, "") : "";
  const borderpayWebhookUrl = cleanSiteUrl
    ? `${cleanSiteUrl}/api/borderpay-webhook`
    : "https://your-convex-site.convex.site/api/borderpay-webhook";
  const temanqrisWebhookUrl = cleanSiteUrl
    ? `${cleanSiteUrl}/api/temanqris-webhook`
    : "https://your-convex-site.convex.site/api/temanqris-webhook";

  const activeWebhookUrl =
    credentialTab === "temanqris" ? temanqrisWebhookUrl : borderpayWebhookUrl;

  const handleCopyWebhookUrl = () => {
    void navigator.clipboard.writeText(activeWebhookUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleFetchMethods = async () => {
    setIsFetching(true);
    setFeedback(null);
    try {
      await fetchMethods({ organizationId });
      setFeedback({
        type: "success",
        message: t("treasury.gateway.fetchSuccess"),
      });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : t("treasury.gateway.fetchError"),
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      await saveConfig({
        organizationId,
        apiKey: apiKey.trim() || undefined,
        webhookToken: webhookToken.trim(),
        isEnabled,
        qrisName: qrisName.trim() || undefined,
        methodOverrides: {
          qrisEnabled,
          vaEnabled,
          ewalletEnabled,
          enabledBanks: vaEnabled
            ? enabledBanks.length > 0
              ? enabledBanks
              : ["BCA", "BNI", "MANDIRI", "BRI", "PERMATA", "CIMB"]
            : [],
          enabledWallets: ewalletEnabled
            ? enabledWallets.length > 0
              ? enabledWallets
              : ["DANA", "SHOPEE", "OVO"]
            : [],
          customQrisFee:
            qrisGateway === "temanqris"
              ? {
                  type: customQrisFeeType,
                  value: Number(customQrisFeeValue) || 0,
                }
              : undefined,
        },
        channelRouting: {
          qrisGateway,
          vaGateway,
          ewalletGateway,
        },
        providerConfigs: {
          temanqris: {
            apiKey: temanQrisApiKey.trim() || undefined,
            webhookToken: temanQrisWebhookSecret.trim() || undefined,
            isTestMode: false,
          },
        },
      });
      setApiKey("");
      setTemanQrisApiKey("");
      setFeedback({
        type: "success",
        message: t("treasury.gateway.savedSuccess"),
      });
      if (config?.hasApiKey || config?.providerConfigs?.temanqris?.hasApiKey) {
        setIsEditingCredentials(false);
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save settings.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleBank = (code: string) => {
    setEnabledBanks((prev) =>
      prev.includes(code) ? prev.filter((b) => b !== code) : [...prev, code]
    );
  };

  const toggleWallet = (code: string) => {
    setEnabledWallets((prev) =>
      prev.includes(code) ? prev.filter((w) => w !== code) : [...prev, code]
    );
  };

  const fallbackGateways: GatewayOption[] = [
    { id: "borderpay", name: "BorderPay (Default)", supportedChannels: ["qris", "va", "ewallet"] },
    { id: "temanqris", name: "TemanQRIS", supportedChannels: ["qris"] },
  ];

  const gatewaysList: GatewayOption[] =
    (availableGateways as GatewayOption[] | undefined) || fallbackGateways;

  const qrisGateways = gatewaysList.filter(
    (g: GatewayOption) => !g.supportedChannels || g.supportedChannels.includes("qris")
  );
  const vaGateways = gatewaysList.filter(
    (g: GatewayOption) => !g.supportedChannels || g.supportedChannels.includes("va")
  );
  const ewalletGateways = gatewaysList.filter(
    (g: GatewayOption) => !g.supportedChannels || g.supportedChannels.includes("ewallet")
  );

  return (
    <Card telemetry="TREASURY.PAYMENTS" cornerLines className="bg-card border-border shadow-xl">
      {/* ── CARD HEADER ── */}
      <CardHeader className="pb-4 border-b border-border/70">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 border border-primary/30 text-primary">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                {t("treasury.gateway.title")}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t("treasury.gateway.description")}
              </CardDescription>
            </div>
          </div>

          {/* Master Switch with Mode Badge */}
          <div className="flex items-center gap-3 bg-muted/20 border border-border/60 px-3 py-1.5">
            {config?.hasApiKey && (
              <Badge
                variant={config.isTestMode ? "warning" : "success"}
                className="font-mono text-[10px] px-2 py-0.5"
              >
                {config.isTestMode
                  ? t("treasury.gateway.testModeBadge")
                  : t("treasury.gateway.liveModeBadge")}
              </Badge>
            )}

            <div className="flex items-center gap-2 border-l border-border/60 pl-2.5">
              <Switch
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
                aria-label={t("treasury.gateway.enableGateway")}
              />
              <span className="text-xs font-mono font-medium">
                {isEnabled
                  ? t("treasury.gateway.statusActive")
                  : t("treasury.gateway.statusDisabled")}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={(e) => { void handleSave(e); }}>
        <CardContent className="space-y-6 pt-5">
          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-3 border text-xs font-mono flex items-center gap-2 ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                  : "bg-destructive/15 border-destructive/40 text-destructive-foreground"
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{feedback.message}</span>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 1: GATEWAY PROVIDERS & CREDENTIALS
          ══════════════════════════════════════════════════════════════════ */}
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
                    chamfer="dual"
                    disabled={isFetching}
                    onClick={() => void handleFetchMethods()}
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
                          chamfer="dual"
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
                          chamfer="dual"
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
                          chamfer="dual"
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
                          chamfer="dual"
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
                      chamfer="dual"
                      onClick={handleCopyWebhookUrl}
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

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 2: METHOD ROUTING (THE CORE OPERATIONAL SURFACE)
          ══════════════════════════════════════════════════════════════════ */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  {t("treasury.gateway.routeTitle")}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {t("treasury.gateway.routeSubtitle")}
                </p>
              </div>
            </div>

            {/* ── RAIL 1: QRIS ── */}
            <div
              className={`p-3.5 border transition-all ${
                qrisEnabled
                  ? "bg-card border-border/90 shadow-sm"
                  : "bg-muted/10 border-border/40 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 border border-primary/20 text-primary mt-0.5">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {t("treasury.gateway.qrisTitle")}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                        NATIONAL STANDARD
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {t("treasury.gateway.qrisDesc")}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground/80">
                      {qrisGateway === "temanqris"
                        ? t(
                            "treasury.gateway.temanqrisFeeNote",
                            "TemanQRIS: 0% gateway commission. Upfront surcharge configurable below."
                          )
                        : t("treasury.gateway.qrisFeeNote")}
                    </p>
                  </div>
                </div>

                <Switch
                  checked={qrisEnabled}
                  onCheckedChange={setQrisEnabled}
                  aria-label={t("treasury.gateway.qrisTitle")}
                />
              </div>

              {/* Gateway Assignment Selector & Surcharge Config */}
              {qrisEnabled && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground font-mono text-[11px] flex items-center gap-1.5">
                      <span>{t("treasury.gateway.routeVia")}:</span>
                    </span>

                    <select
                      value={qrisGateway}
                      onChange={(e) => setQrisGateway(e.target.value)}
                      className="bg-black/40 border border-border/80 text-foreground font-mono text-xs px-2.5 py-1 focus:border-primary focus:outline-none transition-colors"
                    >
                      {qrisGateways.map((g: GatewayOption) => (
                        <option key={g.id} value={g.id} className="bg-neutral-900 text-foreground">
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* QRIS Merchant Display Name (Bold Title in QRIS Header) */}
                  <div className="p-3 bg-muted/15 border border-border/60 space-y-1.5">
                    <label
                      htmlFor="qris-display-name"
                      className="text-xs font-semibold text-foreground flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-primary" />
                        <span>{t("treasury.gateway.qrisDisplayName", "QRIS Display Name")}</span>
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">ASPI / BI Standard</span>
                    </label>
                    <Input
                      id="qris-display-name"
                      type="text"
                      chamfer="dual"
                      value={qrisName}
                      onChange={(e) => setQrisName(e.target.value)}
                      placeholder="e.g. BoredKevin Design"
                      className="font-sans text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {t(
                        "treasury.gateway.qrisDisplayNameHelp",
                        "Nama usaha atau organisasi yang dicetak tebal di bagian atas template QRIS."
                      )}
                    </p>
                  </div>

                  {/* TemanQRIS Custom Surcharge Configuration */}
                  {qrisGateway === "temanqris" && (
                    <div className="p-3 bg-muted/20 border border-border/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-primary" />
                          {t("treasury.gateway.qrisSurchargeTitle", "TemanQRIS Surcharge / Fee Settings")}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono border-primary/30 text-primary"
                        >
                          {customQrisFeeValue > 0
                            ? `${customQrisFeeType === "flat" ? "Rp " : ""}${customQrisFeeValue}${customQrisFeeType === "percent" ? "%" : ""} surcharge`
                            : "Rp 0 (Free)"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {t(
                          "treasury.gateway.qrisSurchargeDesc",
                          "TemanQRIS transaction fee is Rp 0. You can optionally configure an upfront fee surcharge added to the invoice total."
                        )}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <select
                          value={customQrisFeeType}
                          onChange={(e) =>
                            setCustomQrisFeeType(e.target.value as "flat" | "percent")
                          }
                          className="bg-black/40 border border-border/80 text-foreground font-mono text-xs px-2.5 py-1.5 focus:border-primary focus:outline-none"
                        >
                          <option value="flat">Fixed Surcharge (Rp)</option>
                          <option value="percent">Percentage Surcharge (%)</option>
                        </select>
                        <Input
                          type="number"
                          min="0"
                          step={customQrisFeeType === "flat" ? "100" : "0.1"}
                          value={customQrisFeeValue}
                          onChange={(e) =>
                            setCustomQrisFeeValue(parseFloat(e.target.value) || 0)
                          }
                          className="font-mono text-xs max-w-[140px]"
                          placeholder="0"
                        />
                        <span className="text-xs font-mono text-muted-foreground">
                          {customQrisFeeType === "flat" ? "IDR" : "%"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── RAIL 2: VIRTUAL ACCOUNTS (BANK TRANSFER) ── */}
            <div
              className={`p-3.5 border transition-all ${
                vaEnabled
                  ? "bg-card border-border/90 shadow-sm"
                  : "bg-muted/10 border-border/40 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 border border-primary/20 text-primary mt-0.5">
                    <Building className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {t("treasury.gateway.vaTitle")}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono border-border/70 text-muted-foreground">
                        {enabledBanks.length > 0
                          ? t("treasury.gateway.banksActiveCount", { count: enabledBanks.length })
                          : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {t("treasury.gateway.vaDesc")}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground/80">
                      {t("treasury.gateway.vaFeeNote")}
                    </p>
                  </div>
                </div>

                <Switch
                  checked={vaEnabled}
                  onCheckedChange={(checked) => {
                    setVaEnabled(checked);
                    if (checked && enabledBanks.length === 0) {
                      setEnabledBanks(["BCA", "BNI", "MANDIRI", "BRI", "PERMATA", "CIMB"]);
                    }
                  }}
                  aria-label={t("treasury.gateway.vaTitle")}
                />
              </div>

              {/* Gateway Assignment & Customization Row */}
              {vaEnabled && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground font-mono text-[11px] flex items-center gap-1.5">
                      <span>{t("treasury.gateway.routeVia")}:</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <select
                        value={vaGateway}
                        onChange={(e) => setVaGateway(e.target.value)}
                        className="bg-black/40 border border-border/80 text-foreground font-mono text-xs px-2.5 py-1 focus:border-primary focus:outline-none transition-colors"
                      >
                        {vaGateways.map((g: GatewayOption) => (
                          <option key={g.id} value={g.id} className="bg-neutral-900 text-foreground">
                            {g.name}
                          </option>
                        ))}
                      </select>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCustomizingBanks(!isCustomizingBanks)}
                        className="h-7 text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 border border-border/50"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        <span>{t("treasury.gateway.customizeBanks")}</span>
                        {isCustomizingBanks ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Collapsible Banks Grid (Hidden by Default) */}
                  {isCustomizingBanks && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border/40 animate-in fade-in-50 duration-150">
                      {standardBanks.map((bank) => {
                        const active = enabledBanks.includes(bank.code);
                        return (
                          <div
                            key={bank.code}
                            onClick={() => toggleBank(bank.code)}
                            className={`p-2 border transition-all cursor-pointer flex items-center justify-between ${
                              active
                                ? "bg-primary/15 border-primary/50 text-foreground"
                                : "bg-muted/10 border-border/40 text-muted-foreground hover:border-border"
                            }`}
                          >
                            <span className="font-mono text-xs font-medium">{bank.name}</span>
                            <Switch
                              checked={active}
                              onCheckedChange={() => toggleBank(bank.code)}
                              aria-label={`Toggle ${bank.name}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── RAIL 3: E-WALLETS ── */}
            <div
              className={`p-3.5 border transition-all ${
                ewalletEnabled
                  ? "bg-card border-border/90 shadow-sm"
                  : "bg-muted/10 border-border/40 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 border border-primary/20 text-primary mt-0.5">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {t("treasury.gateway.ewalletTitle")}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono border-border/70 text-muted-foreground">
                        {enabledWallets.length > 0
                          ? t("treasury.gateway.walletsActiveCount", { count: enabledWallets.length })
                          : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {t("treasury.gateway.ewalletDesc")}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground/80">
                      {t("treasury.gateway.ewalletFeeNote")}
                    </p>
                  </div>
                </div>

                <Switch
                  checked={ewalletEnabled}
                  onCheckedChange={(checked) => {
                    setEwalletEnabled(checked);
                    if (checked && enabledWallets.length === 0) {
                      setEnabledWallets(["DANA", "SHOPEE", "OVO"]);
                    }
                  }}
                  aria-label={t("treasury.gateway.ewalletTitle")}
                />
              </div>

              {/* Gateway Assignment & Customization Row */}
              {ewalletEnabled && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground font-mono text-[11px] flex items-center gap-1.5">
                      <span>{t("treasury.gateway.routeVia")}:</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <select
                        value={ewalletGateway}
                        onChange={(e) => setEwalletGateway(e.target.value)}
                        className="bg-black/40 border border-border/80 text-foreground font-mono text-xs px-2.5 py-1 focus:border-primary focus:outline-none transition-colors"
                      >
                        {ewalletGateways.map((g: GatewayOption) => (
                          <option key={g.id} value={g.id} className="bg-neutral-900 text-foreground">
                            {g.name}
                          </option>
                        ))}
                      </select>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCustomizingWallets(!isCustomizingWallets)}
                        className="h-7 text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 border border-border/50"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        <span>{t("treasury.gateway.customizeWallets")}</span>
                        {isCustomizingWallets ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Collapsible Wallets Grid (Hidden by Default) */}
                  {isCustomizingWallets && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border/40 animate-in fade-in-50 duration-150">
                      {standardWallets.map((wallet) => {
                        const active = enabledWallets.includes(wallet.code);
                        return (
                          <div
                            key={wallet.code}
                            onClick={() => toggleWallet(wallet.code)}
                            className={`p-2 border transition-all cursor-pointer flex items-center justify-between ${
                              active
                                ? "bg-primary/15 border-primary/50 text-foreground"
                                : "bg-muted/10 border-border/40 text-muted-foreground hover:border-border"
                            }`}
                          >
                            <span className="font-mono text-xs font-medium">{wallet.name}</span>
                            <Switch
                              checked={active}
                              onCheckedChange={() => toggleWallet(wallet.code)}
                              aria-label={`Toggle ${wallet.name}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>

        {/* ── CARD FOOTER ── */}
        <CardFooter className="pt-4 border-t border-border/80 flex flex-wrap justify-between items-center gap-3">
          <div className="text-[11px] text-muted-foreground font-mono">
            {config?.updatedAt ? (
              <span>Last updated: {new Date(config.updatedAt).toLocaleString()}</span>
            ) : (
              <span>No configuration saved yet</span>
            )}
          </div>

          <Button
            type="submit"
            variant="cyber"
            chamfer="dual"
            disabled={isSaving}
            className="text-xs font-medium flex items-center gap-1.5"
          >
            {isSaving ? t("treasury.gateway.saving") : t("treasury.gateway.saveSettings")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
