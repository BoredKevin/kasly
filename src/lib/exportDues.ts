import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import packageJson from "../../package.json";

export interface DuesExportEvent {
  _id: string;
  periodLabel: string;
  dueDate: number;
  amount: number;
  totalMembers: number;
  paidCount: number;
}

export interface DuesExportMember {
  _id: string;
  userId: string;
  name: string;
  email?: string;
  nickname?: string;
  image?: string;
  unpaidPeriodsCount: number;
  totalPaidAmount: number;
}

export interface DuesExportCell {
  hasPaid: boolean;
  isWaived?: boolean;
  paidAt?: number;
  ledgerEntryId?: string;
}

export interface DuesExportPayload {
  fundName: string;
  organizationName?: string;
  currency?: string;
  events: DuesExportEvent[];
  members: DuesExportMember[];
  cellMap: Map<string, DuesExportCell>;
  rangeLabel?: string;
  summary?: {
    totalUnpaidMemberships?: number;
    totalEvents?: number;
    config?: {
      isEnabled: boolean;
      intervalType: string;
      intervalValue: number;
      amount: number;
    } | null;
  };
}

export interface DuesMemberSummary {
  member: DuesExportMember;
  rangePaid: number;
  rangeUnpaid: number;
}

export interface DuesReportAggregates {
  rangeMemberTotals: DuesMemberSummary[];
  totalPaidSum: number;
  totalUnpaidSum: number;
  totalExpected: number;
  totalCollected: number;
  collectionRate: number;
}

// ==========================================
// Formatting & Calculation Helpers
// ==========================================

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

// ==========================================
// Font Loader
// ==========================================

let cachedJakartaRegular: string | null = null;
let cachedJakartaBold: string | null = null;

async function loadJakartaFont(doc: jsPDF): Promise<string> {
  try {
    if (!cachedJakartaRegular) {
      const res = await fetch(
        "https://cdn.jsdelivr.net/fontsource/fonts/plus-jakarta-sans@latest/latin-400-normal.ttf"
      );
      if (res.ok) {
        const buf = await res.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        cachedJakartaRegular = btoa(binary);
      }
    }

    if (!cachedJakartaBold) {
      const res = await fetch(
        "https://cdn.jsdelivr.net/fontsource/fonts/plus-jakarta-sans@latest/latin-700-normal.ttf"
      );
      if (res.ok) {
        const buf = await res.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        cachedJakartaBold = btoa(binary);
      }
    }

    if (cachedJakartaRegular) {
      doc.addFileToVFS("PlusJakartaSans-Regular.ttf", cachedJakartaRegular);
      doc.addFont("PlusJakartaSans-Regular.ttf", "PlusJakartaSans", "normal");
    }
    if (cachedJakartaBold) {
      doc.addFileToVFS("PlusJakartaSans-Bold.ttf", cachedJakartaBold);
      doc.addFont("PlusJakartaSans-Bold.ttf", "PlusJakartaSans", "bold");
    }

    return cachedJakartaRegular ? "PlusJakartaSans" : "helvetica";
  } catch (err) {
    console.warn("Could not load Plus Jakarta Sans into jsPDF, falling back to helvetica:", err);
    return "helvetica";
  }
}

// ==========================================
// PDF Header & KPI Drawing
// ==========================================

function drawReportHeader(
  doc: jsPDF,
  fontName: string,
  payload: DuesExportPayload,
  pageWidth: number,
  formattedNow: string
): void {
  const { fundName, organizationName = "Kasly Workspace", currency = "IDR", rangeLabel } = payload;

  doc.setFont(fontName, "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("KASLY TREASURY — DUES & PAYMENTS REPORT", 40, 42);

  doc.setFont(fontName, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  const headerSubtitle = rangeLabel
    ? `Organization: ${organizationName}   |   Fund: ${fundName}   |   Range: ${rangeLabel}   |   Currency: ${currency}`
    : `Organization: ${organizationName}   |   Fund: ${fundName}   |   Currency: ${currency}   |   Generated: ${formattedNow}`;
  doc.text(headerSubtitle, 40, 58);

  // Decorative header separator line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(1);
  doc.line(40, 68, pageWidth - 40, 68);
}

function drawKpiSummaryBox(
  doc: jsPDF,
  fontName: string,
  payload: DuesExportPayload,
  aggregates: DuesReportAggregates,
  pageWidth: number
): void {
  const { currency = "IDR", members, events } = payload;
  const { totalExpected, totalCollected, collectionRate } = aggregates;

  const summaryBoxY = 78;
  const summaryBoxHeight = 44;
  const summaryBoxWidth = pageWidth - 80;
  const chamfer = 9;

  // Background and border with dual chamfer (top-right & bottom-left cut corners)
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(1);

  const chamferLines: [number, number][] = [
    [summaryBoxWidth - chamfer, 0], // Top edge
    [chamfer, chamfer], // Top-right diagonal chamfer
    [0, summaryBoxHeight - chamfer], // Right edge
    [-(summaryBoxWidth - chamfer), 0], // Bottom edge
    [-chamfer, -chamfer], // Bottom-left diagonal chamfer
    [0, -(summaryBoxHeight - chamfer)], // Left edge back to start
  ];
  doc.lines(chamferLines, 40, summaryBoxY, [1, 1], "FD", true);

  const kpis = [
    { label: "ENROLLED MEMBERS", value: `${members.length}` },
    { label: "CYCLES IN RANGE", value: `${events.length}` },
    { label: "TOTAL COLLECTED", value: formatCurrency(totalCollected, currency) },
    { label: "TOTAL OUTSTANDING", value: formatCurrency(Math.max(0, totalExpected - totalCollected), currency) },
    { label: "COLLECTION RATE", value: `${collectionRate}%` },
  ];

  const colWidth = summaryBoxWidth / kpis.length;

  // Draw subtle vertical dividers between KPI segments
  for (let i = 1; i < kpis.length; i++) {
    const sepX = 40 + i * colWidth;
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.8);
    doc.line(sepX, summaryBoxY + 8, sepX, summaryBoxY + summaryBoxHeight - 8);
  }

  kpis.forEach((kpi, i) => {
    const x = 40 + i * colWidth + 12;
    doc.setFont(fontName, "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(kpi.label, x, summaryBoxY + 16);

    doc.setFont(fontName, "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(kpi.value, x, summaryBoxY + 34);
  });
}

// ==========================================
// Main PDF Generator
// ==========================================

/**
 * Generates and downloads a vector-styled PDF report (.pdf) in landscape orientation
 * with KPI summary cards and an auto-paginated dues matrix table.
 */
export async function exportDuesToPdf(payload: DuesExportPayload): Promise<void> {
  const {
    fundName,
    currency = "IDR",
    events,
    cellMap,
  } = payload;

  const dateStr = new Date().toISOString().slice(0, 10);
  const formattedNow = new Date().toLocaleString();

  // 1. Calculate Aggregates
  const aggregates = calculateDuesAggregates(payload);
  const { rangeMemberTotals, totalPaidSum, totalUnpaidSum } = aggregates;

  // 2. Initialize PDF in Landscape A4
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  const fontName = await loadJakartaFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();

  // 3. Draw Header Section & KPI Box
  drawReportHeader(doc, fontName, payload, pageWidth, formattedNow);
  drawKpiSummaryBox(doc, fontName, payload, aggregates, pageWidth);

  // 4. Calculate Column Spacing & Header Geometry
  const availableTableWidth = pageWidth - 80;
  const fixedColsWidth = 22 + (events.length <= 6 ? 140 : events.length > 20 ? 100 : 110) + 65 + 55;
  const eventColWidth = events.length > 0 ? (availableTableWidth - fixedColsWidth) / events.length : 100;
  const isNarrow = eventColWidth < 52 || events.length > 8;

  // 5. Build AutoTable Data Structure
  const head = [
    [
      "#",
      "Member",
      `Paid (${currency})`,
      "Unpaid",
      ...events.map((e) =>
        isNarrow
          ? formatDueDateYMD(e.dueDate)
          : `${e.periodLabel}\n${formatDueDateShort(e.dueDate)}`
      ),
    ],
  ];

  const body = rangeMemberTotals.map(({ member, rangePaid, rangeUnpaid }, index) => {
    const row: (string | number)[] = [
      index + 1,
      member.nickname ? `${member.nickname} (${member.name})` : member.name,
      rangePaid.toLocaleString(),
      rangeUnpaid > 0 ? `${rangeUnpaid} Unpaid` : "Fully Paid",
    ];

    events.forEach((event) => {
      const cell = cellMap.get(`${member._id}_${event._id}`);
      if (cell?.hasPaid) {
        if (cell.isWaived) {
          row.push("WAIVED");
        } else {
          row.push("PAID");
        }
      } else {
        row.push("UNPAID");
      }
    });

    return row;
  });

  const foot = [
    [
      "",
      "TOTALS",
      totalPaidSum.toLocaleString(),
      `${totalUnpaidSum} Unpaid`,
      ...events.map((e) => `${e.paidCount}/${e.totalMembers}`),
    ],
  ];

  // Dynamic font sizing & header height
  const tableFontSize = events.length <= 6 ? 8 : events.length <= 12 ? 7 : events.length > 20 ? 5.5 : 6;
  const headerFontSize = isNarrow ? (events.length > 20 ? 5.5 : 6.5) : tableFontSize;
  const headerMinHeight = isNarrow ? (events.length > 20 ? 48 : 52) : 24;

  // 6. Generate Table with AutoTable
  autoTable(doc, {
    startY: 134,
    margin: { left: 40, right: 40, bottom: 40 },
    head,
    body,
    foot,
    theme: "grid",
    styles: {
      font: fontName,
    },
    headStyles: {
      font: fontName,
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontSize: headerFontSize,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      cellPadding: isNarrow ? 2 : 3,
      minCellHeight: headerMinHeight,
    },
    footStyles: {
      font: fontName,
      fillColor: [241, 245, 249], // slate-100
      textColor: [15, 23, 42],
      fontSize: tableFontSize,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 3,
    },
    bodyStyles: {
      font: fontName,
      fontSize: tableFontSize,
      textColor: [51, 65, 85],
      halign: "center",
      cellPadding: isNarrow ? 2 : 3,
    },
    columnStyles: {
      0: { cellWidth: events.length > 20 ? 20 : 22, halign: "center" }, // #
      1: { cellWidth: events.length <= 6 ? 140 : events.length > 20 ? 100 : 110, halign: "left", fontStyle: "bold" }, // Member Name
      2: { cellWidth: events.length > 20 ? 60 : 65, halign: "right" }, // Total Paid
      3: { cellWidth: events.length > 20 ? 50 : 55, halign: "center" }, // Status/Unpaid
    },
    didParseCell: (data) => {
      // Clear header text for narrow event columns so autotable doesn't wrap/draw it horizontally
      if (data.section === "head" && isNarrow && data.column.index >= 4) {
        data.cell.text = [""];
      }

      // Style specific body cell statuses
      if (data.section === "body" && data.column.index >= 4) {
        const rawVal = typeof data.cell.raw === "string" ? data.cell.raw : data.cell.text.join("");
        if (rawVal === "PAID" || rawVal === "✓") {
          data.cell.styles.fillColor = [220, 252, 231]; // emerald-100
          data.cell.text = [""]; // Cleared so vector checkmark is cleanly drawn in didDrawCell
        } else if (rawVal === "UNPAID" || rawVal === "✗") {
          data.cell.styles.fillColor = [254, 226, 226]; // rose-100
          data.cell.text = [""]; // Cleared so vector cross is cleanly drawn in didDrawCell
        } else if (rawVal === "WAIVED") {
          data.cell.styles.fillColor = [237, 233, 254]; // violet-100
          data.cell.styles.textColor = [109, 40, 217]; // violet-700
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 6;
          data.cell.text = ["WAIVED"];
        }
      }
    },
    didDrawCell: (data) => {
      // Draw vertical date text for narrow event header cells
      if (data.section === "head" && isNarrow && data.column.index >= 4) {
        const eventIndex = data.column.index - 4;
        const event = events[eventIndex];
        if (event) {
          const dateText = formatDueDateYMD(event.dueDate);
          const { x, y, width, height } = data.cell;
          const cx = x + width / 2;

          doc.saveGraphicsState();
          doc.setFont(fontName, "bold");
          doc.setFontSize(headerFontSize);
          doc.setTextColor(255, 255, 255);

          const textWidth = doc.getTextWidth(dateText);
          const startY = y + Math.max(4, (height - textWidth) / 2);

          // Angle -90 rotates text 90 deg clockwise (reads downwards from top to bottom)
          doc.text(dateText, cx, startY, {
            angle: -90,
            align: "left",
            baseline: "middle",
          });
          doc.restoreGraphicsState();
        }
      }

      // Draw crisp vector checkmark or cross inside body cell
      if (data.section === "body" && data.column.index >= 4) {
        const rawVal = typeof data.cell.raw === "string" ? data.cell.raw : "";
        const { x, y, width, height } = data.cell;
        const cx = x + width / 2;
        const cy = y + height / 2;
        const isDense = events.length > 20;
        const strokeW = isDense ? 1.2 : 1.4;

        if (rawVal === "PAID" || rawVal === "✓") {
          // Draw crisp emerald green vector checkmark
          doc.setDrawColor(21, 128, 61); // emerald-700
          doc.setLineWidth(strokeW);
          if (isDense) {
            doc.line(cx - 2.6, cy - 0.4, cx - 0.8, cy + 1.8);
            doc.line(cx - 0.8, cy + 1.8, cx + 3.0, cy - 2.2);
          } else {
            doc.line(cx - 3.2, cy - 0.5, cx - 1, cy + 2.2);
            doc.line(cx - 1, cy + 2.2, cx + 3.8, cy - 2.8);
          }
        } else if (rawVal === "UNPAID" || rawVal === "✗") {
          // Draw crisp rose red vector cross (X)
          doc.setDrawColor(220, 38, 38); // rose-600
          doc.setLineWidth(strokeW);
          const r = isDense ? 2.4 : 2.8;
          doc.line(cx - r, cy - r, cx + r, cy + r);
          doc.line(cx + r, cy - r, cx - r, cy + r);
        }
      }
    },
    didDrawPage: (data) => {
      // Add Footer on every page
      const currentYear = new Date().getFullYear();
      const buildHash = typeof __BUILD_HASH__ !== "undefined" ? __BUILD_HASH__ : "dev";
      const footerText = `© ${currentYear} boredkevin/kasly v${packageJson.version} • ${buildHash} • kasly.bkev.in`;

      doc.setFont(fontName, "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400

      const footerY = doc.internal.pageSize.getHeight() - 20;
      doc.text(footerText, 40, footerY);
      doc.text(`Page ${data.pageNumber}`, pageWidth - 40, footerY, { align: "right" });
    },
  });

  // 7. Save PDF File
  const filename = `${sanitizeFilename(fundName)}_dues_report_${dateStr}.pdf`;
  doc.save(filename);
}
