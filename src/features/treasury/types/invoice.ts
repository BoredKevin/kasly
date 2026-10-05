import { Doc, Id } from "../../../../convex/_generated/dataModel";

export type InvoiceDoc = Doc<"invoices">;
export type InvoiceId = Id<"invoices">;

export type InvoiceStatus = "draft" | "pending" | "paid" | "expired" | "cancelled";
export type InvoiceType = "dues" | "custom";
export type PaymentMethodType = "qris" | "va" | "ewallet";

export interface InvoiceCheckoutProps {
  invoice: InvoiceDoc;
  publicMethods: any;
  selectedMethod: PaymentMethodType;
  setSelectedMethod: (method: PaymentMethodType) => void;
  selectedBank: string;
  setSelectedBank: (bank: string) => void;
  selectedWallet: string;
  setSelectedWallet: (wallet: string) => void;
  previewFee: number;
  previewTotal: number;
  isInitiating: boolean;
  errorMessage: string | null;
  onInitiatePayment: () => void;
}
