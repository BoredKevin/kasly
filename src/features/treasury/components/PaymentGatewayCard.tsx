import { useState } from "react";
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
} from "lucide-react";

interface PaymentGatewayCardProps {
  organizationId: Id<"organizations">;
}

export function PaymentGatewayCard({ organizationId }: PaymentGatewayCardProps) {
  const { t } = useTranslation();

  const config = useQuery(api.treasury.borderpay.getPaymentConfig, { organizationId });
  const saveConfig = useAction(api.treasury.borderpay.savePaymentConfig);
  const fetchMethods = useAction(api.treasury.borderpay.fetchAvailablePaymentMethods);

  const [apiKey, setApiKey] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [qrisEnabled, setQrisEnabled] = useState(true);
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

  const [isCopied, setIsCopied] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [hasInitialized, setHasInitialized] = useState(false);

  // Sync state when config query resolves
  if (config && !hasInitialized) {
    setIsEnabled(config.isEnabled);
    setWebhookToken(config.webhookToken || "");
    if (config.methodOverrides) {
      setQrisEnabled(config.methodOverrides.qrisEnabled);
      setEnabledBanks(config.methodOverrides.enabledBanks);
      setEnabledWallets(config.methodOverrides.enabledWallets);
    }
    setHasInitialized(true);
  }

  // Derive webhook URL from the Convex site HTTP actions URL
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
          enabledBanks,
          enabledWallets,
        },
      });
      setApiKey(""); // Clear sensitive input after saving
      setFeedback({
        type: "success",
        message: t("treasury.gateway.savedSuccess"),
      });
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

  // Supported bank and wallet definitions
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

  return (
    <Card telemetry="GATEWAY.BORDERPAY" cornerLines className="bg-card border-border shadow-lg">
      <CardHeader className="pb-4 border-b border-border/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 border border-primary/30 text-primary">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                {t("treasury.gateway.title")}
              </CardTitle>
              <CardDescription className="text-xs">
                {t("treasury.gateway.description")}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {config?.hasApiKey && (
              <Badge
                variant={config.isTestMode ? "warning" : "success"}
                className="font-mono text-xs px-2 py-0.5"
              >
                {config.isTestMode
                  ? t("treasury.gateway.testModeBadge")
                  : t("treasury.gateway.liveModeBadge")}
              </Badge>
            )}

            <div className="flex items-center gap-2 pl-2 border-l border-border/60">
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave(e);
        }}
      >
        <CardContent className="space-y-6 pt-5">
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

          {/* Section 1: API Key & Webhook Credentials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="borderpay-api-key"
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
                id="borderpay-api-key"
                type="password"
                chamfer="dual"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config?.hasApiKey ? "Leave blank to keep existing key" : t("treasury.gateway.apiKeyPlaceholder")}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                {t("treasury.gateway.apiKeyHelp")}
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="borderpay-webhook-token"
                className="text-xs font-medium text-foreground flex items-center gap-1.5"
              >
                <Webhook className="w-3.5 h-3.5 text-primary" />
                {t("treasury.gateway.webhookToken")}
              </label>
              <Input
                id="borderpay-webhook-token"
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
          <div className="p-3 bg-muted/20 border border-border/70 space-y-2">
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
                {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{isCopied ? t("common.copied") : t("common.copy")}</span>
              </Button>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground bg-black/40 p-2 border border-border/40 select-all break-all">
              {webhookUrl}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t("treasury.gateway.webhookUrlHelp")}
            </p>
          </div>

          {/* Section 2: Automated CLE Gateway Signing Key Status */}
          {config?.gatewayKeyId && (
            <div className="p-3 bg-emerald-500/[0.04] border border-emerald-500/20 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-300">
                    {t("treasury.gateway.signingKeyTitle")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {t("treasury.gateway.signingKeyDesc")}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] border-emerald-500/30 text-emerald-400">
                KEY ID: {config.gatewayKeyId}
              </Badge>
            </div>
          )}

          {/* Section 3: Channel Toggles & Live Method Sync */}
          <div className="space-y-4 pt-2 border-t border-border/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-semibold text-foreground">
                  {t("treasury.gateway.channelsTitle")}
                </h4>
                <p className="text-[10px] text-muted-foreground">
                  {t("treasury.gateway.channelsSubtitle")}
                </p>
              </div>

              {config?.hasApiKey && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="dual"
                  disabled={isFetching}
                  onClick={() => {
                    void handleFetchMethods();
                  }}
                  className="text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
                  <span>{isFetching ? t("treasury.gateway.fetching") : t("treasury.gateway.fetchLiveMethods")}</span>
                </Button>
              )}
            </div>

            {/* QRIS Channel Card */}
            <div className="p-3 bg-muted/15 border border-border/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/30 text-primary">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {t("treasury.gateway.qrisTitle")}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
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

            {/* Virtual Account Banks Grid */}
            <div className="p-3 bg-muted/15 border border-border/60 space-y-2.5">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-foreground">
                  {t("treasury.gateway.vaTitle")}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  ({enabledBanks.length} enabled)
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">
                {t("treasury.gateway.vaFeeNote")}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {standardBanks.map((bank) => {
                  const active = enabledBanks.includes(bank.code);
                  return (
                    <div
                      key={bank.code}
                      onClick={() => toggleBank(bank.code)}
                      className={`p-2 border transition-all cursor-pointer flex items-center justify-between ${
                        active
                          ? "bg-primary/15 border-primary/50 text-foreground"
                          : "bg-muted/20 border-border/50 text-muted-foreground hover:border-border"
                      }`}
                    >
                      <span className="font-mono text-xs font-semibold">{bank.name}</span>
                      <Switch
                        checked={active}
                        onCheckedChange={() => toggleBank(bank.code)}
                        aria-label={`Toggle ${bank.name}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* E-Wallets Grid */}
            <div className="p-3 bg-muted/15 border border-border/60 space-y-2.5">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-foreground">
                  {t("treasury.gateway.ewalletTitle")}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  ({enabledWallets.length} enabled)
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">
                {t("treasury.gateway.ewalletFeeNote")}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {standardWallets.map((wallet) => {
                  const active = enabledWallets.includes(wallet.code);
                  return (
                    <div
                      key={wallet.code}
                      onClick={() => toggleWallet(wallet.code)}
                      className={`p-2 border transition-all cursor-pointer flex items-center justify-between ${
                        active
                          ? "bg-primary/15 border-primary/50 text-foreground"
                          : "bg-muted/20 border-border/50 text-muted-foreground hover:border-border"
                      }`}
                    >
                      <span className="font-mono text-xs font-semibold">{wallet.name}</span>
                      <Switch
                        checked={active}
                        onCheckedChange={() => toggleWallet(wallet.code)}
                        aria-label={`Toggle ${wallet.name}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-4 border-t border-border/80 flex justify-between items-center">
          <div className="text-[11px] text-muted-foreground font-mono">
            {config?.updatedAt && (
              <span>Last updated: {new Date(config.updatedAt).toLocaleString()}</span>
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
