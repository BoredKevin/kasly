import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Switch,
} from "@boredkevin/ui";
import { Panel, StatusPill } from "../../../ui";
import {
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { GatewayOption, BankOption, WalletOption } from "./gateway/gatewayTypes";
import { GatewayCredentialsSection } from "./gateway/GatewayCredentialsSection";
import { ChannelRoutingSection } from "./gateway/ChannelRoutingSection";

interface PaymentGatewayCardProps {
  organizationId: Id<"organizations">;
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
  const standardBanks: BankOption[] = [
    { code: "BCA", name: "BCA" },
    { code: "BNI", name: "BNI" },
    { code: "MANDIRI", name: "Mandiri" },
    { code: "BRI", name: "BRI" },
    { code: "PERMATA", name: "Permata" },
    { code: "CIMB", name: "CIMB Niaga" },
  ];

  const standardWallets: WalletOption[] = [
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

  // Async Execution States
  const [isSaving, setIsSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [isCopied, setIsCopied] = useState(false);

  // Prepopulate state when config loads
  useEffect(() => {
    if (config) {
      setIsEnabled(config.isEnabled);

      if (config.methodOverrides) {
        setQrisEnabled(config.methodOverrides.qrisEnabled);
        setVaEnabled(config.methodOverrides.vaEnabled ?? true);
        setEwalletEnabled(config.methodOverrides.ewalletEnabled ?? true);

        if (config.methodOverrides.enabledBanks && config.methodOverrides.enabledBanks.length > 0) {
          setEnabledBanks(config.methodOverrides.enabledBanks);
        }
        if (config.methodOverrides.enabledWallets && config.methodOverrides.enabledWallets.length > 0) {
          setEnabledWallets(config.methodOverrides.enabledWallets);
        }
        if (config.methodOverrides.customQrisFee) {
          setCustomQrisFeeType(config.methodOverrides.customQrisFee.type || "flat");
          setCustomQrisFeeValue(config.methodOverrides.customQrisFee.value || 0);
        }
      }

      if (config.channelRouting) {
        setQrisGateway(config.channelRouting.qrisGateway || "borderpay");
        setVaGateway(config.channelRouting.vaGateway || "borderpay");
        setEwalletGateway(config.channelRouting.ewalletGateway || "borderpay");
      }

      if (config.qrisName) {
        setQrisName(config.qrisName);
      }
    }
  }, [config]);

  const borderpayWebhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/gateways/webhook/borderpay`
      : "/api/gateways/webhook/borderpay";

  const temanQrisWebhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/gateways/webhook/temanqris`
      : "/api/gateways/webhook/temanqris";

  const activeWebhookUrl =
    credentialTab === "temanqris" ? temanQrisWebhookUrl : borderpayWebhookUrl;

  const handleCopyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(activeWebhookUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      setFeedback({
        type: "error",
        message: "Failed to copy webhook URL to clipboard.",
      });
    }
  };

  const handleFetchMethods = async () => {
    setIsFetching(true);
    setFeedback(null);
    try {
      const res = await fetchMethods({ organizationId });
      if (res.success && res.methods) {
        setFeedback({
          type: "success",
          message: t("treasury.gateway.fetchSuccess", {
            count: res.methods.length,
          }),
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || t("treasury.gateway.fetchFailed"),
        });
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to query methods.",
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
        isEnabled,
        apiKey: apiKey.trim() || undefined,
        webhookToken: webhookToken.trim() || undefined,
        qrisName: qrisName.trim() || undefined,
        methodOverrides: {
          qrisEnabled,
          vaEnabled,
          ewalletEnabled,
          enabledBanks: vaEnabled ? enabledBanks : [],
          enabledWallets: ewalletEnabled ? enabledWallets : [],
          customQrisFee: {
            type: customQrisFeeType,
            value: customQrisFeeValue,
          },
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
    <Panel className="shadow-lg">
      {/* ── CARD HEADER ── */}
      <CardHeader className="pb-4 border-b border-border/70">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 border border-primary/30 text-primary rounded-[var(--fintech-radius-sm)]">
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
          <div className="flex items-center gap-3 bg-muted/20 border border-border/60 rounded-[var(--fintech-radius-sm)] px-3 py-1.5">
            {config?.hasApiKey && (
              <StatusPill
                tone={config.isTestMode ? "warning" : "success"}
              >
                {config.isTestMode
                  ? t("treasury.gateway.testModeBadge")
                  : t("treasury.gateway.liveModeBadge")}
              </StatusPill>
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

          {/* SECTION 1: GATEWAY PROVIDERS & CREDENTIALS */}
          <GatewayCredentialsSection
            credentialTab={credentialTab}
            setCredentialTab={setCredentialTab}
            config={config}
            isFetching={isFetching}
            onFetchMethods={() => void handleFetchMethods()}
            isEditingCredentials={isEditingCredentials}
            setIsEditingCredentials={setIsEditingCredentials}
            apiKey={apiKey}
            setApiKey={setApiKey}
            webhookToken={webhookToken}
            setWebhookToken={setWebhookToken}
            temanQrisApiKey={temanQrisApiKey}
            setTemanQrisApiKey={setTemanQrisApiKey}
            temanQrisWebhookSecret={temanQrisWebhookSecret}
            setTemanQrisWebhookSecret={setTemanQrisWebhookSecret}
            activeWebhookUrl={activeWebhookUrl}
            isCopied={isCopied}
            onCopyWebhookUrl={() => void handleCopyWebhookUrl()}
          />

          {/* SECTION 2: METHOD ROUTING */}
          <ChannelRoutingSection
            qrisEnabled={qrisEnabled}
            setQrisEnabled={setQrisEnabled}
            qrisGateway={qrisGateway}
            setQrisGateway={setQrisGateway}
            qrisGateways={qrisGateways}
            qrisName={qrisName}
            setQrisName={setQrisName}
            customQrisFeeType={customQrisFeeType}
            setCustomQrisFeeType={setCustomQrisFeeType}
            customQrisFeeValue={customQrisFeeValue}
            setCustomQrisFeeValue={setCustomQrisFeeValue}

            vaEnabled={vaEnabled}
            setVaEnabled={setVaEnabled}
            vaGateway={vaGateway}
            setVaGateway={setVaGateway}
            vaGateways={vaGateways}
            enabledBanks={enabledBanks}
            standardBanks={standardBanks}
            isCustomizingBanks={isCustomizingBanks}
            setIsCustomizingBanks={setIsCustomizingBanks}
            toggleBank={toggleBank}
            setEnabledBanks={setEnabledBanks}

            ewalletEnabled={ewalletEnabled}
            setEwalletEnabled={setEwalletEnabled}
            ewalletGateway={ewalletGateway}
            setEwalletGateway={setEwalletGateway}
            ewalletGateways={ewalletGateways}
            enabledWallets={enabledWallets}
            standardWallets={standardWallets}
            isCustomizingWallets={isCustomizingWallets}
            setIsCustomizingWallets={setIsCustomizingWallets}
            toggleWallet={toggleWallet}
            setEnabledWallets={setEnabledWallets}
          />
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
            chamfer="none"
            disabled={isSaving}
            className="text-xs font-medium flex items-center gap-1.5"
          >
            {isSaving ? t("treasury.gateway.saving") : t("treasury.gateway.saveSettings")}
          </Button>
        </CardFooter>
      </form>
    </Panel>
  );
}
