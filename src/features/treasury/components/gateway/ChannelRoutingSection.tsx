import { useTranslation } from "react-i18next";
import { Badge, Switch, Button, Input } from "@boredkevin/ui";
import {
  Layers,
  QrCode,
  Coins,
  Building,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  Wallet,
} from "lucide-react";
import { GatewayOption, BankOption, WalletOption } from "./gatewayTypes";

export interface ChannelRoutingSectionProps {
  qrisEnabled: boolean;
  setQrisEnabled: (val: boolean) => void;
  qrisGateway: string;
  setQrisGateway: (val: string) => void;
  qrisGateways: GatewayOption[];
  qrisName: string;
  setQrisName: (val: string) => void;
  customQrisFeeType: "flat" | "percent";
  setCustomQrisFeeType: (val: "flat" | "percent") => void;
  customQrisFeeValue: number;
  setCustomQrisFeeValue: (val: number) => void;

  vaEnabled: boolean;
  setVaEnabled: (val: boolean) => void;
  vaGateway: string;
  setVaGateway: (val: string) => void;
  vaGateways: GatewayOption[];
  enabledBanks: string[];
  standardBanks: BankOption[];
  isCustomizingBanks: boolean;
  setIsCustomizingBanks: (val: boolean) => void;
  toggleBank: (code: string) => void;
  setEnabledBanks: (banks: string[]) => void;

  ewalletEnabled: boolean;
  setEwalletEnabled: (val: boolean) => void;
  ewalletGateway: string;
  setEwalletGateway: (val: string) => void;
  ewalletGateways: GatewayOption[];
  enabledWallets: string[];
  standardWallets: WalletOption[];
  isCustomizingWallets: boolean;
  setIsCustomizingWallets: (val: boolean) => void;
  toggleWallet: (code: string) => void;
  setEnabledWallets: (wallets: string[]) => void;
}

export function ChannelRoutingSection({
  qrisEnabled,
  setQrisEnabled,
  qrisGateway,
  setQrisGateway,
  qrisGateways,
  qrisName,
  setQrisName,
  customQrisFeeType,
  setCustomQrisFeeType,
  customQrisFeeValue,
  setCustomQrisFeeValue,

  vaEnabled,
  setVaEnabled,
  vaGateway,
  setVaGateway,
  vaGateways,
  enabledBanks,
  standardBanks,
  isCustomizingBanks,
  setIsCustomizingBanks,
  toggleBank,
  setEnabledBanks,

  ewalletEnabled,
  setEwalletEnabled,
  ewalletGateway,
  setEwalletGateway,
  ewalletGateways,
  enabledWallets,
  standardWallets,
  isCustomizingWallets,
  setIsCustomizingWallets,
  toggleWallet,
  setEnabledWallets,
}: ChannelRoutingSectionProps) {
  const { t } = useTranslation();

  return (
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
                chamfer="none"
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
  );
}
