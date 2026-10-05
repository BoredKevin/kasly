import { Id } from "../../../../convex/_generated/dataModel";

export interface LedgerEntryItem {
  _id: Id<"ledgerEntries">;
  _creationTime: number;
  organizationId: Id<"organizations">;
  fundId: Id<"funds">;
  sequenceNumber: number;
  previousHash: string;
  entryHash: string;
  timestamp: number;
  direction: string;
  amount: number;
  memo: string;
  keyId: string;
  signerId: Id<"users">;
  signerName?: string;
  signature: string;
  transferId?: string;
  entryType?: string;
  duesEventId?: Id<"duesEvents">;
}

export interface RevertMemoInfo {
  isRevert: boolean;
  targetSequenceNumber?: number;
  reason?: string;
}
