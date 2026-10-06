/**
 * Backward-Compatibility Facade for BorderPay & Invoicing.
 *
 * NOTE: The treasury system has been modularized into:
 *  - convex/treasury/invoices.ts (Invoicing domain)
 *  - convex/treasury/settlement.ts (Automated CLE signing & ledger commits)
 *  - convex/treasury/gateways/router.ts (Gateway abstraction, methods & payment initiation)
 *  - convex/treasury/gateways/adapters/borderpay.ts (BorderPay specific adapter)
 *
 * This file maintains 100% backward compatibility for existing frontend components
 * and external webhook callers without breaking existing API routes.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getGatewayAdapter } from "./gateways/registry";
import "./gateways/adapters/index";

// 1. Invoicing domain re-exports
export {
  createDuesInvoice,
  createCustomInvoice,
  updateInvoice,
  deleteInvoice,
  cancelInvoice,
  getInvoice,
  getInvoiceById,
  listInvoices,
  _getInvoiceByNumber,
  _updateInvoicePendingPayment,
} from "./invoices";

// 2. Gateway router re-exports
export {
  listAvailableGateways,
  getPaymentConfig,
  savePaymentConfig,
  fetchAvailablePaymentMethods,
  syncCheckoutPaymentMethods,
  getPublicPaymentMethods,
  initiatePayment,
  simulatePayment,
  confirmCustomerPayment,
  verifyAndSettleTemanQrisOrder,
  _getAuthAndExistingConfigForSave,
  _saveConfigMutation,
  _getInternalConfig,
  _getConfigByWebhookToken,
  _saveFetchedMethods,
} from "./gateways/router";

// 3. Settlement context and completion re-exports
export {
  _getInvoiceAndPaymentContext,
  _completeInvoicePaidMutation,
} from "./settlement";

/**
 * Fee calculation utility preserved for backward compatibility.
 */
export function calculateGatewayFee(
  subtotal: number,
  method: "qris" | "va" | "ewallet",
  bankOrWalletCode?: string,
  rawMethods?: any
): number {
  const adapter = getGatewayAdapter("borderpay");
  return adapter.calculateFee(subtotal, method, bankOrWalletCode, rawMethods);
}

/**
 * Legacy webhook handler action delegating to the universal settlement engine.
 */
export const internalMarkInvoicePaid = internalAction({
  args: {
    referenceId: v.string(),
    paidAt: v.number(),
    borderpayData: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<any> => {
    return await ctx.runAction(internal.treasury.settlement.settleInvoicePayment, {
      referenceId: args.referenceId,
      paidAt: args.paidAt,
      provider: "borderpay",
      metadata: args.borderpayData,
    });
  },
});
