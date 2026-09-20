export function formatAmount(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function formatMonthYear(dateStr: string): string {
  const d = new Date(dateStr);
  return `${ARABIC_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatDayMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getUTCDate()} ${ARABIC_MONTHS[d.getUTCMonth()]}`;
}

export function formatDayMonthYear(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getUTCDate()} ${ARABIC_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  let hours = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "م" : "ص";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${period}`;
}

export function firstOfCurrentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function relativeDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setUTCDate(today.getUTCDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate();

  if (sameDay(date, today)) return "اليوم";
  if (sameDay(date, yesterday)) return "أمس";
  return formatDayMonthYear(dateStr);
}

export function initial(name: string | null | undefined): string {
  return name?.trim()?.[0]?.toUpperCase() ?? "؟";
}
