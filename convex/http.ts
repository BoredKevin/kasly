import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { getGatewayAdapter } from "./treasury/gateways/registry";
import "./treasury/gateways/adapters/index";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * BorderPay automated webhook endpoint.
 * Receives payment status updates (payment.paid, payment.expired, payment.failed).
 */
http.route({
  path: "/api/borderpay-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const token = req.headers.get("x-borderpay-token");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing x-borderpay-token header." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Match verification token against organizationPaymentConfig
    const config = await ctx.runQuery(
      internal.treasury.gateways.router._getConfigByWebhookToken,
      { webhookToken: token }
    );

    if (!config) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid verification token." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    let payload: Record<string, any>;
    try {
      const bodyText = await req.text();
      payload = JSON.parse(bodyText);
    } catch {
      return new Response(
        JSON.stringify({ error: "Bad Request: Malformed JSON body." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = payload?.data;
    const event = req.headers.get("x-borderpay-event") || payload?.event;

    // Process payment.paid event via universal settlement engine
    if (data?.reference_id && (data.status === "paid" || event === "payment.paid")) {
      await ctx.runAction(internal.treasury.settlement.settleInvoicePayment, {
        referenceId: data.reference_id,
        paidAt: Date.now(),
        provider: "borderpay",
        metadata: data,
      });
    }

    return new Response(JSON.stringify({ received: true, status: "processed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

/**
 * TemanQRIS automated webhook endpoint.
 * Receives payment status updates (payment.awaiting_confirmation, payment.confirmed).
 * Cryptographically verifies HMAC-SHA256 signature using the organization's webhook secret.
 */
http.route({
  path: "/api/temanqris-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const signature =
      req.headers.get("x-temanqris-signature") ||
      req.headers.get("X-TemanQRIS-Signature");

    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing x-temanqris-signature header." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const bodyText = await req.text();
    let payload: Record<string, any>;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return new Response(
        JSON.stringify({ error: "Bad Request: Malformed JSON body." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = payload?.data;
    const event =
      req.headers.get("x-temanqris-event") ||
      req.headers.get("X-TemanQRIS-Event") ||
      payload?.event;

    const orderId = data?.order_id || payload?.order_id;
    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "Bad Request: Missing order_id in webhook payload." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Lookup invoice & organization payment context
    const invoiceContext = await ctx.runQuery(
      internal.treasury.settlement._getInvoiceAndPaymentContext,
      { referenceId: orderId }
    );

    if (!invoiceContext?.invoice) {
      return new Response(
        JSON.stringify({ error: "Not Found: No matching invoice found for order_id." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const config = await ctx.runQuery(
      internal.treasury.gateways.router._getInternalConfig,
      { organizationId: invoiceContext.invoice.organizationId }
    );

    // Resolve TemanQRIS secret (webhook token or API key)
    const secret =
      config?.providerConfigs?.temanqris?.webhookToken ||
      config?.webhookToken ||
      config?.providerConfigs?.temanqris?.apiKey ||
      config?.apiKey ||
      "";

    // Verify webhook signature with TemanQrisAdapter
    const adapter = getGatewayAdapter("temanqris");
    const webhookHeaders: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      webhookHeaders[key] = value;
    });
    const verification = await adapter.verifyAndParseWebhook(ctx, {
      headers: webhookHeaders,
      bodyText,
      parsedBody: payload,
      secret,
    });

    if (!verification.isValid) {
      return new Response(
        JSON.stringify({ error: `Unauthorized: ${verification.error || "Invalid signature"}` }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle payment.confirmed -> CLE settlement
    if (verification.eventType === "payment.paid") {
      await ctx.runAction(internal.treasury.settlement.settleInvoicePayment, {
        referenceId: verification.invoiceNumber,
        paidAt: verification.paidAt || Date.now(),
        provider: "temanqris",
        metadata: data,
      });
    } else if (
      event === "payment.awaiting_confirmation" ||
      data?.status === "awaiting_confirmation"
    ) {
      // Flag invoice as awaiting verification without crediting ledger
      await ctx.runMutation(
        internal.treasury.gateways.router._flagInvoiceAwaitingConfirmation,
        { invoiceId: invoiceContext.invoice._id }
      );
    }

    return new Response(
      JSON.stringify({ received: true, status: "processed" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }),
});

export default http;
