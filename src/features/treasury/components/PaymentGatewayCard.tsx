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
} from "lucide-react";

interface PaymentGatewayCardProps {
  organizationId: Id<"organizations">;
}

export function PaymentGatewayCard({ organizationId }: PaymentGatewayCardProps) {
  const { t } = useTranslation();

  const config = useQuery(api.treasury.gateways.router.getPaymentConfig, { organizationId });
  const availableGateways = useQuery(api.treasury.gateways.router.listAvailableGateways);
  const saveConfig = useAction(api.treasury.gateways.router.savePaymentConfig);
  const fetchMethods = useAction(api.treasury.gateways.router.fetchAvailablePaymentMethods);

  const [apiKey, setApiKey] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);

  // Method Rail Toggles
  const [qrisEnabled, setQrisEnabled] = useState(true);
  const [vaEnabled, setVaEnabled] = useState(true);
  const [ewalletEnabled, setEwalletEnabled] = useState(true);

  // Gateway Routing Assignments
  const [qrisGateway, setQrisGateway] = useState("borderpay");
  const [vaGateway, setVaGateway] = useState("borderpay");
  const [ewalletGateway, setEwalletGateway] = useState("borderpay");

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
    if (config && !hasInitialized) {
      setIsEnabled(config.isEnabled);
      setWebhookToken(config.webhookToken || "");
      if (config.methodOverrides) {
        setQrisEnabled(config.methodOverrides.qrisEnabled);
        setEnabledBanks(config.methodOverrides.enabledBanks);
        setVaEnabled(config.methodOverrides.enabledBanks.length > 0);
        setEnabledWallets(config.methodOverrides.enabledWallets);
        setEwalletEnabled(config.methodOverrides.enabledWallets.length > 0);
      }
      if (config.channelRouting) {
        setQrisGateway(config.channelRouting.qrisGateway || "borderpay");
        setVaGateway(config.channelRouting.vaGateway || "borderpay");
        setEwalletGateway(config.channelRouting.ewalletGateway || "borderpay");
      }
      // Auto-expand credentials if not yet set up
      if (!config.hasApiKey) {
        setIsEditingCredentials(true);
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
  const webhookUrl = cleanSiteUrl
    ? `${cleanSiteUrl}/api/borderpay-webhook`
    : "https://your-convex-site.convex.site/api/borderpay-webhook";

  const handleCopyWebhookUrl = () => {
    void navigator.clipboard.writeText(webhookUrl);
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
        methodOverrides: {
          qrisEnabled,
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
        },
        channelRouting: {
          qrisGateway,
          vaGateway,
          ewalletGateway,
        },
      });
      setApiKey("");
      setFeedback({
        type: "success",
        message: t("treasury.gateway.savedSuccess"),
      });
      if (config?.hasApiKey) {
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

  const gatewaysList = availableGateways || [
    { id: "borderpay", name: "BorderPay (Default)" },
  ];

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

      <form onSubmit={handleSave}>
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
              SECTION 1: COMPACT GATEWAY PROVIDER & CREDENTIALS
          ══════════════════════════════════════════════════════════════════ */}
          <div className="border border-border/80 bg-muted/10 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                  <Settings2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      BorderPay Gateway
                    </span>
                    {config?.hasApiKey ? (
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
                    {t("treasury.gateway.gatewaySettingsSubtitle")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {config?.hasApiKey && (
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

            {/* Collapsible Credentials & Webhook Form */}
            {isEditingCredentials && (
              <div className="pt-4 border-t border-border/60 space-y-4 animate-in fade-in-50 duration-150">
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

                {/* Target Webhook URL Banner */}
                <div className="p-3 bg-black/40 border border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Webhook className="w-3.5 h-3.5 text-primary" />
                      {t("treasury.gateway.webhookUrl")}
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
                    {webhookUrl}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {t("treasury.gateway.webhookUrlHelp")}
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
                      {t("treasury.gateway.qrisFeeNote")}
                    </p>
                  </div>
                </div>

                <Switch
                  checked={qrisEnabled}
                  onCheckedChange={setQrisEnabled}
                  aria-label={t("treasury.gateway.qrisTitle")}
                />
              </div>

              {/* Gateway Assignment Selector */}
              {qrisEnabled && (
                <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground font-mono text-[11px] flex items-center gap-1.5">
                    <span>{t("treasury.gateway.routeVia")}:</span>
                  </span>

                  <select
                    value={qrisGateway}
                    onChange={(e) => setQrisGateway(e.target.value)}
                    className="bg-black/40 border border-border/80 text-foreground font-mono text-xs px-2.5 py-1 focus:border-primary focus:outline-none transition-colors"
                  >
                    {gatewaysList.map((g) => (
                      <option key={g.id} value={g.id} className="bg-neutral-900 text-foreground">
                        {g.name}
                      </option>
                    ))}
                  </select>
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
                        {gatewaysList.map((g) => (
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
                        {gatewaysList.map((g) => (
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
