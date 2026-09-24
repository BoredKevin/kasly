import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

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
      internal.treasury.borderpay._getConfigByWebhookToken,
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

    // Process payment.paid event
    if (data?.reference_id && (data.status === "paid" || event === "payment.paid")) {
      await ctx.runMutation(internal.treasury.borderpay.internalMarkInvoicePaid, {
        referenceId: data.reference_id,
        paidAt: Date.now(),
        borderpayData: data,
      });
    }

    return new Response(JSON.stringify({ received: true, status: "processed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
