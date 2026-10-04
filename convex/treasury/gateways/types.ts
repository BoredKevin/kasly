import { ActionCtx } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";

export type PaymentChannelType =
  | "qris"
  | "va"
  | "ewallet"
  | "card"
  | "bank_transfer"
  | "other";

export interface NormalizedPaymentMethod {
  id: string; // e.g. "borderpay:bni_va" or "qris"
  channelType: PaymentChannelType;
  code: string; // e.g. "BNI", "QRIS", "DANA"
  name: string; // e.g. "BNI Virtual Account"
  logoUrl?: string;
  minAmount?: number;
  maxAmount?: number;
  fee: {
    flat: number;
    percent: number;
  };
  provider: string; // "borderpay"
  isEnabled: boolean;
}

export interface GatewayConfigRecord {
  _id: Id<"organizationPaymentConfig">;
  organizationId: Id<"organizations">;
  provider: string;
  apiKey: string;
  webhookToken?: string;
  gatewayKeyId?: string;
  gatewayPrivateKeyJwk?: string;
  isEnabled: boolean;
  isTestMode: boolean;
  rawFetchedMethods?: unknown;
  methodOverrides?: {
    qrisEnabled: boolean;
    enabledBanks: string[];
    enabledWallets: string[];
    customQrisFee?: {
      type: "flat" | "percent";
      value: number;
    };
  };
  channelRouting?: {
    qrisGateway?: string;
    vaGateway?: string;
    ewalletGateway?: string;
  };
  providerConfigs?: Record<
    string,
    {
      apiKey: string;
      webhookToken?: string;
      isTestMode?: boolean;
    }
  >;
  lastFetchedAt?: number;
  updatedAt: number;
}

export interface PaymentInitiationRequest {
  invoice: Doc<"invoices">;
  channelType: PaymentChannelType;
  channelCode?: string;
  returnUrl?: string;
}

export interface PaymentInitiationResult {
  provider: string;
  providerReferenceId: string;
  qrString?: string;
  qrImage?: string;
  vaNumber?: string;
  vaBank?: string;
  payUrl?: string;
  checkoutUrl?: string;
  expiresAt: number;
  fee: number;
  totalAmount: number;
  rawResponse?: unknown;
}

export interface WebhookVerificationRequest {
  headers: Record<string, string>;
  bodyText: string;
  parsedBody?: unknown;
  secret?: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  error?: string;
  eventType: "payment.paid" | "payment.expired" | "payment.failed" | "ignored";
  invoiceNumber: string;
  providerReferenceId?: string;
  amountPaid?: number;
  paidAt?: number;
  rawPayload?: unknown;
}

export interface PaymentSimulationRequest {
  invoiceNumber: string;
  providerReferenceId?: string;
}

export interface PaymentSimulationResult {
  success: boolean;
  message?: string;
  rawResponse?: unknown;
}

/**
 * Standard interface for all payment gateway adapters in Kasly.
 */
export interface PaymentGatewayAdapter {
  /** Unique identifier for the provider (e.g. "borderpay", "midtrans") */
  readonly provider: string;

  /** Human-readable display name */
  readonly displayName: string;

  /** Calculate gateway fees upfront for an invoice amount */
  calculateFee(
    subtotal: number,
    channelType: PaymentChannelType,
    channelCode?: string,
    rawMetadata?: unknown
  ): number;

  /** Fetch live payment methods / channels from upstream gateway API */
  fetchPaymentMethods(
    ctx: ActionCtx,
    config: GatewayConfigRecord
  ): Promise<NormalizedPaymentMethod[]>;

  /** Initiate a payment request with upstream gateway API */
  initiatePayment(
    ctx: ActionCtx,
    config: GatewayConfigRecord,
    request: PaymentInitiationRequest
  ): Promise<PaymentInitiationResult>;

  /** Verify incoming webhook authentication and parse payload */
  verifyAndParseWebhook(
    ctx: ActionCtx,
    request: WebhookVerificationRequest
  ): Promise<WebhookVerificationResult>;

  /** Optional sandbox payment simulation for testing and admin verification */
  simulatePayment?(
    ctx: ActionCtx,
    config: GatewayConfigRecord,
    request: PaymentSimulationRequest
  ): Promise<PaymentSimulationResult>;
}
