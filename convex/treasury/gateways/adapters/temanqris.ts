import { ActionCtx } from "../../../_generated/server";
import { internal } from "../../../_generated/api";
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

const TEMANQRIS_API_BASE = "https://temanqris.com/api/qris";
const TEMANQRIS_PUBLIC_BASE = "https://temanqris.com/api/pay";

declare const process: { env: Record<string, string | undefined> };

function parseTemanQrisErrorMessage(errBody: string): string {
  try {
    const parsed = JSON.parse(errBody);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.message === "string") {
        return parsed.message + (parsed.error ? `: ${parsed.error}` : "");
      }
      if (typeof parsed.error === "string") return parsed.error;
      return JSON.stringify(parsed);
    }
  } catch {
    // fallback raw
  }
  return errBody;
}

/**
 * Timing-safe HMAC-SHA256 signature verification using Web Crypto API.
 */
async function verifyHmacSha256(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signed = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(rawBody)
    );
    const hex = Array.from(new Uint8Array(signed))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const expected = `sha256=${hex}`;

    const normalizedSig = signature.trim().toLowerCase();
    const normalizedExpected = expected.toLowerCase();

    if (normalizedSig.length !== normalizedExpected.length) {
      return false;
    }

    let diff = 0;
    for (let i = 0; i < normalizedSig.length; i++) {
      diff |= normalizedSig.charCodeAt(i) ^ normalizedExpected.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export class TemanQrisAdapter implements PaymentGatewayAdapter {
  readonly provider = "temanqris";
  readonly displayName = "TemanQRIS (Dynamic QRIS)";

  /**
   * Resolves the appropriate API key for TemanQRIS, supporting both
   * multi-provider credentials (providerConfigs) and single active provider.
   */
  private getApiKey(config: GatewayConfigRecord): string {
    const multiKey = config.providerConfigs?.temanqris?.apiKey;
    if (multiKey && multiKey.trim().length > 0) {
      return multiKey.trim();
    }
    return config.apiKey ? config.apiKey.trim() : "";
  }

  /**
   * Resolves the Webhook Secret used to authenticate TemanQRIS callbacks.
   */
  public getWebhookSecret(config: GatewayConfigRecord): string {
    const multiSecret = config.providerConfigs?.temanqris?.webhookToken;
    if (multiSecret && multiSecret.trim().length > 0) {
      return multiSecret.trim();
    }
    if (config.webhookToken && config.webhookToken.trim().length > 0) {
      return config.webhookToken.trim();
    }
    return this.getApiKey(config);
  }

  /**
   * Calculates fee upfront for TemanQRIS transactions.
   * Default: Rp 0 (zero extra surcharge).
   * Supports optional custom surcharge configured in methodOverrides.customQrisFee.
   */
  calculateFee(
    subtotal: number,
    channelType: PaymentChannelType,
    _channelCode?: string,
    rawMetadata?: any
  ): number {
    if (channelType !== "qris") {
      return 0;
    }

    const customFee =
      rawMetadata?.customQrisFee ||
      rawMetadata?.methodOverrides?.customQrisFee ||
      rawMetadata?.fee;

    if (customFee) {
      if (customFee.type === "flat" || customFee.type === "rupiah") {
        return Math.max(0, Math.round(Number(customFee.value ?? customFee.flat ?? 0)));
      }
      if (customFee.type === "percent") {
        const pct = Number(customFee.value ?? customFee.percent ?? 0);
        return Math.max(0, Math.ceil(subtotal * (pct / 100)));
      }
    }

    return 0;
  }

  /**
   * Fetches TemanQRIS static QR status and usage limits from upstream API.
   */
  async fetchPaymentMethods(
    ctx: ActionCtx,
    config: GatewayConfigRecord
  ): Promise<NormalizedPaymentMethod[]> {
    const apiKey = this.getApiKey(config);
    if (!apiKey) {
      throw new Error("TemanQRIS API key is not configured.");
    }

    // 1. Check static QRIS status
    const qrisRes = await fetch(`${TEMANQRIS_API_BASE}/my-qris`, {
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    });

    let qrisData: any = null;
    if (qrisRes.ok) {
      qrisData = await qrisRes.json();
    } else {
      const errText = await qrisRes.text();
      console.warn("Could not check TemanQRIS status:", parseTemanQrisErrorMessage(errText));
    }

    // 2. Fetch daily usage metrics (optional audit insight)
    let usageData: any = null;
    try {
      const usageRes = await fetch(`${TEMANQRIS_API_BASE}/usage`, {
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
      });
      if (usageRes.ok) {
        usageData = await usageRes.json();
      }
    } catch {
      // non-blocking
    }

    const merchantName = qrisData?.qris?.merchant_name;
    const hasStaticQris = qrisData?.has_qris !== false;

    const methods: NormalizedPaymentMethod[] = [
      {
        id: "temanqris:qris",
        channelType: "qris",
        code: "QRIS",
        name: merchantName
          ? `QRIS Dinamis (${merchantName})`
          : "QRIS Dinamis (TemanQRIS)",
        minAmount: 1000,
        maxAmount: 10000000,
        fee: {
          flat: 0,
          percent: 0,
        },
        provider: this.provider,
        isEnabled: hasStaticQris,
      },
    ];

    // Persist to database cache
    try {
      await ctx.runMutation(internal.treasury.gateways.router._saveFetchedMethods, {
        configId: config._id,
        methods: {
          temanqris: {
            hasQris: hasStaticQris,
            qris: qrisData?.qris || null,
            usage: usageData || null,
          },
          raw: qrisData,
          normalized: methods,
        },
      });
    } catch (saveErr) {
      console.warn("Could not save TemanQRIS fetched methods:", saveErr);
    }

    return methods;
  }

  /**
   * Generates dynamic QRIS via TemanQRIS /generate API.
   * Produces raw QR string, base64 QR image, and shareable payment link.
   */
  async initiatePayment(
    _ctx: ActionCtx,
    config: GatewayConfigRecord,
    request: PaymentInitiationRequest
  ): Promise<PaymentInitiationResult> {
    const apiKey = this.getApiKey(config);
    if (!apiKey) {
      throw new Error("TemanQRIS API key is not configured.");
    }

    if (request.channelType !== "qris") {
      throw new Error("TemanQRIS only supports QRIS payment rail.");
    }

    const { invoice, returnUrl } = request;

    const fee = this.calculateFee(
      invoice.subtotal,
      "qris",
      undefined,
      config.methodOverrides || config.rawFetchedMethods
    );

    const totalAmount = invoice.subtotal + fee;

    const rawSiteUrl = process.env.CONVEX_SITE_URL || "";
    const cleanSiteUrl = rawSiteUrl ? rawSiteUrl.replace(/\/+$/, "") : "";
    const webhookUrl = cleanSiteUrl
      ? `${cleanSiteUrl}/api/temanqris-webhook`
      : undefined;
    const callbackUrl =
      returnUrl || (cleanSiteUrl ? `${cleanSiteUrl}/invoice/${invoice.invoiceNumber}` : undefined);

    const payload: Record<string, unknown> = {
      amount: totalAmount,
      order_id: invoice.invoiceNumber,
      description: `Invoice ${invoice.invoiceNumber} - ${invoice.title}`,
    };

    if (fee > 0) {
      payload.fee_type = "rupiah";
      payload.fee_value = fee;
    }
    if (webhookUrl) {
      payload.webhook_url = webhookUrl;
    }
    if (callbackUrl) {
      payload.callback_url = callbackUrl;
    }

    const res = await fetch(`${TEMANQRIS_API_BASE}/generate`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      const msg = parseTemanQrisErrorMessage(errBody);
      throw new Error(`TemanQRIS Error (${res.status}): ${msg}`);
    }

    const json = await res.json();
    const linkObj = json.payment_link || {};

    const expiresAt = json.expires_at
      ? new Date(json.expires_at).getTime()
      : linkObj.expires_at
        ? new Date(linkObj.expires_at).getTime()
        : Date.now() + 24 * 3600 * 1000;

    const hostedUrl = linkObj.url
      ? `https://temanqris.com${linkObj.url.startsWith("/") ? "" : "/"}${linkObj.url}`
      : undefined;

    return {
      provider: this.provider,
      providerReferenceId: linkObj.link_code || invoice.invoiceNumber,
      qrString: json.qris || undefined,
      qrImage: json.qr_image || undefined,
      payUrl: hostedUrl,
      checkoutUrl: hostedUrl,
      expiresAt,
      fee,
      totalAmount,
      rawResponse: json,
    };
  }

  /**
   * Cryptographically verifies incoming TemanQRIS webhooks using HMAC-SHA256.
   * Categorizes 'payment.confirmed' as ready for CLE settlement,
   * while marking 'payment.awaiting_confirmation' as informational until approved.
   */
  async verifyAndParseWebhook(
    _ctx: ActionCtx,
    request: WebhookVerificationRequest
  ): Promise<WebhookVerificationResult> {
    const { headers, bodyText, secret } = request;

    const signature =
      headers["x-temanqris-signature"] ||
      headers["X-TemanQRIS-Signature"] ||
      headers["x-temangris-signature"];

    if (!signature) {
      return {
        isValid: false,
        error: "Missing x-temanqris-signature header.",
        eventType: "ignored",
        invoiceNumber: "",
      };
    }

    if (secret) {
      const isSignatureValid = await verifyHmacSha256(bodyText, signature, secret);
      if (!isSignatureValid) {
        return {
          isValid: false,
          error: "Invalid HMAC-SHA256 signature.",
          eventType: "ignored",
          invoiceNumber: "",
        };
      }
    }

    let payload: Record<string, any>;
    try {
      payload = request.parsedBody && typeof request.parsedBody === "object"
        ? (request.parsedBody as Record<string, any>)
        : JSON.parse(bodyText);
    } catch {
      return {
        isValid: false,
        error: "Malformed JSON payload.",
        eventType: "ignored",
        invoiceNumber: "",
      };
    }

    const data = payload?.data || {};
    const event =
      headers["x-temanqris-event"] ||
      headers["X-TemanQRIS-Event"] ||
      payload?.event;

    const orderId = data?.order_id || payload?.order_id;
    if (!orderId) {
      return {
        isValid: false,
        error: "Missing order_id in webhook payload.",
        eventType: "ignored",
        invoiceNumber: "",
      };
    }

    const isConfirmedPaid =
      event === "payment.confirmed" ||
      (data?.status === "paid" && event !== "payment.awaiting_confirmation");

    return {
      isValid: true,
      eventType: isConfirmedPaid ? "payment.paid" : "ignored",
      invoiceNumber: orderId,
      providerReferenceId: data?.link_code ? String(data.link_code) : undefined,
      amountPaid: data?.amount ? Number(data.amount) : undefined,
      paidAt: data?.paid_at ? new Date(data.paid_at).getTime() : Date.now(),
      rawPayload: payload,
    };
  }

  /**
   * Merchant verification call: calls POST /api/qris/orders/:orderId/verify upstream
   * to mark order as paid in TemanQRIS and emit payment.confirmed.
   */
  async simulatePayment(
    _ctx: ActionCtx,
    config: GatewayConfigRecord,
    request: PaymentSimulationRequest
  ): Promise<PaymentSimulationResult> {
    const apiKey = this.getApiKey(config);
    if (!apiKey) {
      throw new Error("TemanQRIS API key is not configured.");
    }

    const orderId = request.invoiceNumber;
    const res = await fetch(`${TEMANQRIS_API_BASE}/orders/${encodeURIComponent(orderId)}/verify`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payer_name: "Admin Verification",
        payer_note: "Verified via Kasly admin dashboard",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      const msg = parseTemanQrisErrorMessage(errText);
      throw new Error(`TemanQRIS verification failed (${res.status}): ${msg}`);
    }

    const json = await res.json();
    return {
      success: true,
      message: json?.message || "Payment verified successfully on TemanQRIS",
      rawResponse: json,
    };
  }

  /**
   * Public customer confirmation trigger ("Saya Sudah Bayar").
   * Calls POST /api/pay/:link_code/confirm without requiring merchant API key.
   */
  async confirmCustomerClaim(linkCode: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${TEMANQRIS_PUBLIC_BASE}/${encodeURIComponent(linkCode)}/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      const msg = parseTemanQrisErrorMessage(errText);
      throw new Error(`Customer confirmation failed (${res.status}): ${msg}`);
    }

    const json = await res.json();
    return {
      success: Boolean(json?.success),
      message: json?.message || "Confirmation submitted",
    };
  }
}
