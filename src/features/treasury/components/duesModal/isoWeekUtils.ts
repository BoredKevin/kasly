export type CreationMode = "single" | "range";
export type RangeType = "weeks" | "months" | "dates";

export function getDateFromIsoWeek(year: number, weekNumber: number): Date {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  const firstMonday = new Date(jan4.getTime() - jan4Day * 86400000);
  const targetThursday = new Date(firstMonday.getTime() + ((weekNumber - 1) * 7 + 3) * 86400000);
  targetThursday.setHours(12, 0, 0, 0);
  return targetThursday;
}

export function formatDateToInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getSuggestedPeriodLabel(
  dateStr: string,
  intervalType: "weekly" | "monthly" | "custom_days" = "monthly"
): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return "";

  if (intervalType === "monthly") {
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } else if (intervalType === "weekly") {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    return `Week ${weekNumber}, ${d.getFullYear()}`;
  } else {
    return `Cycle of ${d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }
}

export function getCurrentIsoWeekNumber(): { year: number; week: number } {
  const now = new Date();
  const target = new Date(now.valueOf());
  const dayNr = (now.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return { year: now.getFullYear(), week: weekNumber };
}
