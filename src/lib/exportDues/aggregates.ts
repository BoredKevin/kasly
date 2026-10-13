import { DuesExportPayload, DuesReportAggregates, DuesMemberSummary } from "./types";

export function formatCurrency(amt: number, currency: string = "IDR"): string {
  if (currency === "IDR") {
    return `Rp ${amt.toLocaleString("id-ID")}`;
  }
  return `${currency} ${amt.toLocaleString()}`;
}

export function formatDueDateYMD(dueDate: number): string {
  const d = new Date(dueDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

export function formatDueDateShort(dueDate: number): string {
  return new Date(dueDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
}

/**
 * Computes range-specific paid/unpaid totals per member and aggregate collection stats.
 */
export function calculateDuesAggregates(payload: DuesExportPayload): DuesReportAggregates {
  const { events, members, cellMap } = payload;

  const rangeMemberTotals: DuesMemberSummary[] = members.map((m) => {
    const rangePaid = events.reduce((sum, e) => {
      const cell = cellMap.get(`${m._id}_${e._id}`);
      return sum + (cell?.hasPaid && !cell.isWaived ? e.amount : 0);
    }, 0);
    const rangeUnpaid = events.reduce((sum, e) => {
      const cell = cellMap.get(`${m._id}_${e._id}`);
      return sum + (!cell?.hasPaid ? 1 : 0);
    }, 0);
    return { member: m, rangePaid, rangeUnpaid };
  });

  const totalPaidSum = rangeMemberTotals.reduce((sum, item) => sum + item.rangePaid, 0);
  const totalUnpaidSum = rangeMemberTotals.reduce((sum, item) => sum + item.rangeUnpaid, 0);
  const totalExpected = events.reduce((sum, e) => sum + e.amount * members.length, 0);
  const totalCollected = events.reduce((sum, e) => sum + e.amount * e.paidCount, 0);
  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  return {
    rangeMemberTotals,
    totalPaidSum,
    totalUnpaidSum,
    totalExpected,
    totalCollected,
    collectionRate,
  };
}
