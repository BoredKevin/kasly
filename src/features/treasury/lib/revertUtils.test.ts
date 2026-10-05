import { describe, it, expect } from "vitest";
import { parseRevertMemo, findReversalForEntry, findTargetEntry } from "./revertUtils";

describe("revertUtils", () => {
  it("correctly identifies non-revert memos", () => {
    expect(parseRevertMemo("Normal dues payment")).toEqual({ isRevert: false });
    expect(parseRevertMemo("")).toEqual({ isRevert: false });
    expect(parseRevertMemo(null)).toEqual({ isRevert: false });
  });

  it("correctly parses canonical revert memo with reason", () => {
    const result = parseRevertMemo("Revert #42: Wrong amount paid");
    expect(result).toEqual({
      isRevert: true,
      targetSequenceNumber: 42,
      reason: "Wrong amount paid",
    });
  });

  it("correctly parses revert memo without reason", () => {
    const result = parseRevertMemo("Revert #15");
    expect(result).toEqual({
      isRevert: true,
      targetSequenceNumber: 15,
      reason: undefined,
    });
  });

  it("finds compensating reversal entry", () => {
    const entries = [
      { sequenceNumber: 1, memo: "Payment" },
      { sequenceNumber: 2, memo: "Revert #1: Duplicate transaction" },
    ];
    const reversal = findReversalForEntry(1, entries);
    expect(reversal).toBeDefined();
    expect(reversal?.sequenceNumber).toBe(2);
    expect(reversal?.revertReason).toBe("Duplicate transaction");
  });

  it("finds target reverted entry", () => {
    const entries = [
      { sequenceNumber: 1, memo: "Payment" },
      { sequenceNumber: 2, memo: "Revert #1" },
    ];
    const target = findTargetEntry(1, entries);
    expect(target).toEqual({ sequenceNumber: 1, memo: "Payment" });
  });
});
