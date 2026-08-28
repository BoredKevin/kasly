export interface RevertInfo {
  isRevert: boolean;
  targetSequenceNumber?: number;
  reason?: string;
}

/**
 * Parses a ledger entry memo to determine if it is a compensating reversal entry.
 * Canonical pattern: "Revert #<sequenceNumber>: <reason>" or "Revert #<sequenceNumber>"
 */
export function parseRevertMemo(memo: string | undefined | null): RevertInfo {
  if (!memo) {
    return { isRevert: false };
  }

  const match = memo.match(/^Revert\s+#(\d+)(?::\s*(.*))?$/i);
  if (!match) {
    return { isRevert: false };
  }

  const targetSequenceNumber = parseInt(match[1], 10);
  const reason = match[2]?.trim();

  return {
    isRevert: true,
    targetSequenceNumber,
    reason: reason || undefined,
  };
}

/**
 * Finds if a specific ledger entry has been reverted by another entry in the list.
 */
export function findReversalForEntry<T extends { memo: string; sequenceNumber: number }>(
  sequenceNumber: number,
  entries: T[] | undefined | null
): (T & { revertReason?: string }) | null {
  if (!entries || entries.length === 0) return null;

  for (const entry of entries) {
    const info = parseRevertMemo(entry.memo);
    if (info.isRevert && info.targetSequenceNumber === sequenceNumber) {
      return {
        ...entry,
        revertReason: info.reason,
      };
    }
  }

  return null;
}

/**
 * Finds the target entry that was reverted by sequence number.
 */
export function findTargetEntry<T extends { sequenceNumber: number }>(
  targetSequenceNumber: number,
  entries: T[] | undefined | null
): T | null {
  if (!entries || entries.length === 0) return null;
  return entries.find((e) => e.sequenceNumber === targetSequenceNumber) ?? null;
}
