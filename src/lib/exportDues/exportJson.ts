import packageJson from "../../../package.json";
import {
  DuesExportPayload,
  DuesExportCell,
  DuesJsonCycle,
  DuesJsonCell,
  DuesJsonMember,
  DuesJsonExport,
  DUES_JSON_FORMAT_VERSION,
} from "./types";
import {
  calculateDuesAggregates,
  formatDueDateYMD,
  formatDueDateShort,
  sanitizeFilename,
} from "./aggregates";

/**
 * Builds the complete structured JSON representation of the dues report.
 * Guaranteed to have formatVersion as the first object property.
 */
export function buildDuesJsonData(payload: DuesExportPayload): DuesJsonExport {
  const {
    fundName,
    organizationName = "Kasly Workspace",
    currency = "IDR",
    events,
    members,
    cellMap,
    rangeLabel = "",
    summary: payloadSummary,
  } = payload;

  const aggregates = calculateDuesAggregates(payload);
  const {
    rangeMemberTotals,
    totalPaidSum,
    totalUnpaidSum,
    totalExpected,
    totalCollected,
    collectionRate,
  } = aggregates;

  const now = new Date();
  const buildHash = typeof __BUILD_HASH__ !== "undefined" ? __BUILD_HASH__ : "dev";

  // Build cycle-level details
  const cycles: DuesJsonCycle[] = events.map((e) => {
    const unpaidCount = Math.max(0, e.totalMembers - e.paidCount);
    const expectedAmount = e.amount * e.totalMembers;
    const collectedAmount = e.amount * e.paidCount;
    const outstandingAmount = Math.max(0, expectedAmount - collectedAmount);
    const cycleCollectionRate =
      e.totalMembers > 0 ? Math.round((e.paidCount / e.totalMembers) * 100) : 0;

    return {
      _id: e._id,
      periodLabel: e.periodLabel,
      dueDate: e.dueDate,
      dueDateFormatted: formatDueDateYMD(e.dueDate),
      dueDateShort: formatDueDateShort(e.dueDate),
      amount: e.amount,
      totalMembers: e.totalMembers,
      paidCount: e.paidCount,
      unpaidCount,
      expectedAmount,
      collectedAmount,
      outstandingAmount,
      collectionRate: cycleCollectionRate,
    };
  });

  // Build member rows with cell statuses
  const memberRows: DuesJsonMember[] = rangeMemberTotals.map(
    ({ member, rangePaid, rangeUnpaid }, index) => {
      const displayName = member.nickname
        ? `${member.nickname} (${member.name})`
        : member.name;
      const rangeStatus = rangeUnpaid > 0 ? `${rangeUnpaid} Unpaid` : "Fully Paid";

      const cells: DuesJsonCell[] = events.map((event) => {
        const cell = cellMap.get(`${member._id}_${event._id}`);
        let status: "PAID" | "UNPAID" | "WAIVED" = "UNPAID";
        if (cell?.hasPaid) {
          status = cell.isWaived ? "WAIVED" : "PAID";
        }

        return {
          eventId: event._id,
          periodLabel: event.periodLabel,
          dueDate: event.dueDate,
          dueDateFormatted: formatDueDateYMD(event.dueDate),
          amount: event.amount,
          status,
          hasPaid: Boolean(cell?.hasPaid),
          isWaived: Boolean(cell?.isWaived),
          paidAt: cell?.paidAt,
          ledgerEntryId: cell?.ledgerEntryId,
        };
      });

      return {
        index: index + 1,
        _id: member._id,
        userId: member.userId,
        name: member.name,
        nickname: member.nickname,
        displayName,
        email: member.email,
        image: member.image,
        rangePaid,
        rangeUnpaid,
        rangeStatus,
        totalPaidAmount: member.totalPaidAmount,
        unpaidPeriodsCount: member.unpaidPeriodsCount,
        cells,
      };
    }
  );

  // Cell records dictionary for direct O(1) key lookups: `${memberId}_${eventId}`
  const cellRecords: Record<string, DuesExportCell> = {};
  cellMap.forEach((cell, key) => {
    cellRecords[key] = {
      hasPaid: cell.hasPaid,
      isWaived: cell.isWaived,
      paidAt: cell.paidAt,
      ledgerEntryId: cell.ledgerEntryId,
    };
  });

  // Table Footer summary
  const tableFooter = {
    label: "TOTALS",
    totalPaidSum,
    totalUnpaidSum,
    totalUnpaidStatus: `${totalUnpaidSum} Unpaid`,
    cycleTotals: events.map((e) => ({
      eventId: e._id,
      periodLabel: e.periodLabel,
      paidCount: e.paidCount,
      totalMembers: e.totalMembers,
      ratio: `${e.paidCount}/${e.totalMembers}`,
      collectedAmount: e.amount * e.paidCount,
      expectedAmount: e.amount * e.totalMembers,
    })),
  };

  // NOTE: formatVersion is explicitly placed as the first property of the root object
  return {
    formatVersion: DUES_JSON_FORMAT_VERSION,
    metadata: {
      title: "KASLY TREASURY — DUES & PAYMENTS REPORT",
      organizationName,
      fundName,
      currency,
      rangeLabel,
      generatedAt: now.toISOString(),
      app: {
        name: "boredkevin/kasly",
        version: packageJson.version,
        buildHash,
        website: "https://kasly.bkev.in",
      },
    },
    summary: {
      enrolledMembers: members.length,
      cyclesInRange: events.length,
      totalCollected,
      totalExpected,
      totalOutstanding: Math.max(0, totalExpected - totalCollected),
      collectionRate,
      totalPaidSum,
      totalUnpaidSum,
      totalUnpaidMemberships: payloadSummary?.totalUnpaidMemberships,
      totalEvents: payloadSummary?.totalEvents,
      config: payloadSummary?.config ?? null,
    },
    cycles,
    members: memberRows,
    cellRecords,
    tableFooter,
  };
}

/**
 * Generates and downloads a structured JSON file (.json) containing all dues data,
 * KPI aggregates, cycle information, member payment records, and cell states.
 */
export function exportDuesToJson(payload: DuesExportPayload): void {
  const { fundName } = payload;
  const dateStr = new Date().toISOString().slice(0, 10);
  const data = buildDuesJsonData(payload);
  const jsonString = JSON.stringify(data, null, 2);

  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filename = `${sanitizeFilename(fundName)}_dues_report_${dateStr}.json`;

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
