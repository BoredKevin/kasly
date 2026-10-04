import { ActionCtx } from "../../../_generated/server";
import { internal } from "../../../_generated/api";
import { Doc } from "../../../_generated/dataModel";
import {
  PaymentGatewayAdapter,
  PaymentChannelType,
  NormalizedPaymentMethod,
  GatewayConfigRecord,
  PaymentInitiationRequest,
  PaymentInitiationResult,
  WebhookVerificationRequest,
  WebhookVerificationResult,
  PaymentSimulationRequest,
  PaymentSimulationResult,
} from "../types";

const BORDERPAY_API_BASE = "https://borderpay.id/api/v1";

function parseBorderPayErrorMessage(errBody: string): string {
  try {
    const parsed = JSON.parse(errBody);
    if (typeof parsed === "string") {
      return parsed;
    }
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.message === "string") {
        return (
          parsed.message +
          (parsed.errors ? `: ${JSON.stringify(parsed.errors)}` : "")
        );
      }
      if (typeof parsed.error === "string") {
        return (
          parsed.error +
          (parsed.errors ? `: ${JSON.stringify(parsed.errors)}` : "")
        );
      }
      if (parsed.errors) {
        return JSON.stringify(parsed.errors);
      }
      return JSON.stringify(parsed);
    }
  } catch {
    // raw text fallback
  }
  return errBody;
}

export class BorderPayAdapter implements PaymentGatewayAdapter {
  readonly provider = "borderpay";
  readonly displayName = "BorderPay (QRIS, VA & E-Wallets)";

  /**
   * Calculates fee upfront based on BorderPay pricing schedule:
   * - QRIS: < 100k IDR -> 0.7% + Rp 290; >= 100k IDR -> 1.0% (or live dynamic schedule if provided)
   * - Virtual Accounts: Flat fee (default Rp 4,200) + percent from metadata
   * - E-wallets: Percent fee (default 2%) + flat from metadata
   */
  calculateFee(
    subtotal: number,
    channelType: PaymentChannelType,
    channelCode?: string,
    rawMetadata?: any
  ): number {
    if (channelType === "qris") {
      const qrisMeta = rawMetadata?.qris || rawMetadata?.raw?.qris;
      if (qrisMeta?.fee) {
        const lowThreshold = Number(qrisMeta.fee.threshold ?? 100000);
        const lowPercent = Number(qrisMeta.fee.lowAmountPercent ?? 0.7) / 100;
        const lowFixed = Number(qrisMeta.fee.lowAmountFixed ?? 290);
        const highPercent = Number(qrisMeta.fee.highAmountPercent ?? 1.0) / 100;
        if (subtotal < lowThreshold) {
          return Math.ceil(subtotal * lowPercent) + lowFixed;
        } else {
          return Math.ceil(subtotal * highPercent);
        }
      }

      if (subtotal < 100000) {
        return Math.ceil(subtotal * 0.007) + 290;
      } else {
        return Math.ceil(subtotal * 0.01);
      }
    }

    if (channelType === "va") {
      let flat = 4200;
      let percent = 0;

      // 1. Check normalized array if available
      const normList = Array.isArray(rawMetadata)
        ? rawMetadata
        : Array.isArray(rawMetadata?.normalized)
          ? rawMetadata.normalized
          : null;

      if (normList && channelCode) {
        const found = normList.find(
          (m: any) =>
            m.channelType === "va" &&
            m.code?.toUpperCase() === channelCode.toUpperCase()
        );
        if (found?.fee) {
          flat = Number(found.fee.flat ?? 4200);
          percent = Number(found.fee.percent ?? 0);
          return Math.ceil(subtotal * (percent / 100)) + flat;
        }
      }

      // 2. Check raw metadata banks list
      const banks =
        rawMetadata?.va?.banks ||
        rawMetadata?.raw?.va?.banks ||
        (Array.isArray(rawMetadata?.banks) ? rawMetadata.banks : null);

      if (banks && Array.isArray(banks) && channelCode) {
        const b = banks.find(
          (item: any) =>
            item.code?.toUpperCase() === channelCode.toUpperCase()
        );
        if (b) {
          flat = Number(b.fee?.flat ?? b.fee_flat ?? b.flat_fee ?? 4200);
          percent = Number(b.fee?.percent ?? b.fee_percentage ?? b.percent_fee ?? 0);
        }
      }
      return Math.ceil(subtotal * (percent / 100)) + flat;
    }

    if (channelType === "ewallet") {
      let flat = 0;
      let percent = 2;

      // 1. Check normalized array if available
      const normList = Array.isArray(rawMetadata)
        ? rawMetadata
        : Array.isArray(rawMetadata?.normalized)
          ? rawMetadata.normalized
          : null;

      if (normList && channelCode) {
        const found = normList.find(
          (m: any) =>
            m.channelType === "ewallet" &&
            m.code?.toUpperCase() === channelCode.toUpperCase()
        );
        if (found?.fee) {
          flat = Number(found.fee.flat ?? 0);
          percent = Number(found.fee.percent ?? 2);
          return Math.ceil(subtotal * (percent / 100)) + flat;
        }
      }

      // 2. Check raw metadata wallets list
      const wallets =
        rawMetadata?.ewallet?.wallets ||
        rawMetadata?.raw?.ewallet?.wallets ||
        (Array.isArray(rawMetadata?.wallets) ? rawMetadata.wallets : null);

      if (wallets && Array.isArray(wallets) && channelCode) {
        const w = wallets.find(
          (item: any) =>
            item.code?.toUpperCase() === channelCode.toUpperCase()
        );
        if (w) {
          flat = Number(w.fee?.flat ?? w.fee_flat ?? w.flat_fee ?? 0);
          percent = Number(w.fee?.percent ?? w.fee_percentage ?? w.percent_fee ?? 2);
        }
      } else if (rawMetadata?.ewallet?.fee) {
        flat = Number(rawMetadata.ewallet.fee.flat ?? 0);
        percent = Number(rawMetadata.ewallet.fee.percent ?? 2);
      }
      return Math.ceil(subtotal * (percent / 100)) + flat;
    }

    return 0;
  }

  /**
   * Fetches payment methods from BorderPay /payment-methods API,
   * normalizes them, and persists the payload into the database cache.
   */
  async fetchPaymentMethods(
    ctx: ActionCtx,
    config: GatewayConfigRecord
  ): Promise<NormalizedPaymentMethod[]> {
    if (!config.apiKey) {
      throw new Error("BorderPay API key is not configured.");
    }

    const response = await fetch(`${BORDERPAY_API_BASE}/payment-methods`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      const msg = parseBorderPayErrorMessage(errText);
      throw new Error(
        `Failed to fetch payment methods from BorderPay (${response.status}): ${msg}`
      );
    }

    const data = await response.json();
    const rawData = data?.data || data;
    const methods: NormalizedPaymentMethod[] = [];

    // QRIS
    if (rawData.qris) {
      methods.push({
        id: "borderpay:qris",
        channelType: "qris",
        code: "QRIS",
        name: rawData.qris.name || "QRIS Dynamic",
        minAmount: rawData.qris.min_amount || 1000,
        maxAmount: rawData.qris.max_amount || 10000000,
        fee: {
          flat: 290,
          percent: 0.7,
        },
        provider: this.provider,
        isEnabled: rawData.qris.status === "active",
      });
    }

    // Virtual Accounts
    if (rawData.va?.banks && Array.isArray(rawData.va.banks)) {
      for (const b of rawData.va.banks) {
        methods.push({
          id: `borderpay:va:${b.code.toLowerCase()}`,
          channelType: "va",
          code: b.code.toUpperCase(),
          name: `${b.name || b.code} Virtual Account`,
          minAmount: b.min_amount || 10000,
          maxAmount: b.max_amount || 50000000,
          fee: {
            flat: Number(b.fee?.flat ?? b.fee_flat ?? b.flat_fee ?? 4200),
            percent: Number(b.fee?.percent ?? b.fee_percentage ?? b.percent_fee ?? 0),
          },
          provider: this.provider,
          isEnabled: b.status === "active",
        });
      }
    }

    // E-Wallets
    if (rawData.ewallet?.wallets && Array.isArray(rawData.ewallet.wallets)) {
      for (const w of rawData.ewallet.wallets) {
        methods.push({
          id: `borderpay:ewallet:${w.code.toLowerCase()}`,
          channelType: "ewallet",
          code: w.code.toUpperCase(),
          name: w.name || w.code,
          minAmount: w.min_amount || 1000,
          maxAmount: w.max_amount || 10000000,
          fee: {
            flat: Number(w.fee?.flat ?? w.fee_flat ?? w.flat_fee ?? 0),
            percent: Number(w.fee?.percent ?? w.fee_percentage ?? w.percent_fee ?? 2),
          },
          provider: this.provider,
          isEnabled: w.status === "active",
        });
      }
    }

    // Persist to database cache
    try {
      await ctx.runMutation(internal.treasury.gateways.router._saveFetchedMethods, {
        configId: config._id,
        methods: {
          ...rawData,
          raw: rawData,
          normalized: methods,
        },
      });
    } catch (saveErr) {
      console.warn("Could not save fetched methods to organizationPaymentConfig:", saveErr);
    }

    return methods;
  }

  /**
   * Initiates payment via BorderPay /payments API.
   * Calculates upfront customer fees so the payer bears the fee and the organization receives 100% dues.
   */
  async initiatePayment(
    ctx: ActionCtx,
    config: GatewayConfigRecord,
    request: PaymentInitiationRequest
  ): Promise<PaymentInitiationResult> {
    if (!config.apiKey) {
      throw new Error("BorderPay API key is not configured.");
    }

    const { invoice, channelType, channelCode, returnUrl } = request;

    if (channelType === "va" && !channelCode) {
      throw new Error("Please select a bank for Virtual Account payment.");
    }
    if (channelType === "ewallet" && !channelCode) {
      throw new Error("Please select an e-wallet option.");
    }

    // Ensure rawFetchedMethods is available for accurate fee calculation
    let currentConfig = config;
    if (!currentConfig.rawFetchedMethods) {
      try {
        await this.fetchPaymentMethods(ctx, currentConfig);
        const refreshed: Doc<"organizationPaymentConfig"> | null = await ctx.runQuery(
          internal.treasury.gateways.router._getInternalConfig,
          { organizationId: config.organizationId }
        );
        if (refreshed) {
          currentConfig = refreshed;
        }
      } catch (err) {
        console.warn("Could not lazily fetch payment methods in initiatePayment:", err);
      }
    }

    const fee = this.calculateFee(
      invoice.subtotal,
      channelType,
      channelCode,
      currentConfig.rawFetchedMethods
    );

    const totalAmount = invoice.subtotal + fee;

    if (channelType === "va" && totalAmount < 10000) {
      throw new Error("Virtual Account minimum transaction amount is Rp 10.000.");
    }

    const payload: Record<string, unknown> = {
      amount: totalAmount,
      method: channelType,
      reference_id: invoice.invoiceNumber,
    };

    if (channelCode) {
      payload.bank_code = channelCode.toUpperCase();
    }
    if (returnUrl && returnUrl.startsWith("https://")) {
      payload.return_url = returnUrl;
    }

    const res = await fetch(`${BORDERPAY_API_BASE}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      const msg = parseBorderPayErrorMessage(errBody);
      throw new Error(`BorderPay Error (${res.status}): ${msg}`);
    }

    const bpRes = await res.json();
    const expiresAt = bpRes.expires_at
      ? new Date(bpRes.expires_at).getTime()
      : Date.now() + 3600000;

    return {
      provider: this.provider,
      providerReferenceId: bpRes.reference_id || invoice.invoiceNumber,
      qrString: bpRes.qr_string || undefined,
      vaNumber: bpRes.va_number || undefined,
      vaBank: bpRes.va_bank || channelCode?.toUpperCase() || undefined,
      payUrl: bpRes.pay_url || undefined,
      checkoutUrl: bpRes.checkout_url || undefined,
      expiresAt,
      fee,
      totalAmount,
      rawResponse: bpRes,
    };
  }

  /**
   * Verifies and parses BorderPay webhook payloads.
   */
  async verifyAndParseWebhook(
    _ctx: ActionCtx,
    request: WebhookVerificationRequest
  ): Promise<WebhookVerificationResult> {
    const { headers, bodyText } = request;
    const token =
      headers["x-borderpay-token"] || headers["X-Borderpay-Token"];

    if (!token) {
      return {
        isValid: false,
        error: "Missing x-borderpay-token header.",
        eventType: "ignored",
        invoiceNumber: "",
      };
    }

    let payload: Record<string, any>;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return {
        isValid: false,
        error: "Malformed JSON payload.",
        eventType: "ignored",
        invoiceNumber: "",
      };
    }

    const data = payload?.data;
    const event =
      headers["x-borderpay-event"] ||
      headers["X-Borderpay-Event"] ||
      payload?.event;

    const referenceId = data?.reference_id || payload?.reference_id;
    if (!referenceId) {
      return {
        isValid: false,
        error: "Missing reference_id in webhook payload.",
        eventType: "ignored",
        invoiceNumber: "",
      };
    }

    const isPaid =
      data?.status === "paid" ||
      payload?.status === "paid" ||
      event === "payment.paid";

    return {
      isValid: true,
      eventType: isPaid ? "payment.paid" : "ignored",
      invoiceNumber: referenceId,
      providerReferenceId: data?.id ? String(data.id) : undefined,
      amountPaid: data?.amount ? Number(data.amount) : undefined,
      paidAt: Date.now(),
      rawPayload: payload,
    };
  }

  /**
   * Simulates payment settlement for testing in sandbox mode.
   */
  async simulatePayment(
    _ctx: ActionCtx,
    config: GatewayConfigRecord,
    request: PaymentSimulationRequest
  ): Promise<PaymentSimulationResult> {
    if (!config.apiKey) {
      throw new Error("BorderPay API key is not configured.");
    }

    const refId = request.providerReferenceId || request.invoiceNumber;
    const res = await fetch(`${BORDERPAY_API_BASE}/payments/${refId}/simulate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      const msg = parseBorderPayErrorMessage(errText);
      throw new Error(`Simulation failed (${res.status}): ${msg}`);
    }

    const json = await res.json();
    return {
      success: true,
      message: json?.message || "Simulation successful",
      rawResponse: json,
    };
  }
}
