"use client";

import { useEffect, useMemo, useState } from "react";
import BottomNav from "@/components/BottomNav";
import { ChevronRightIcon, ChevronLeftIcon } from "@/components/icons";
import { useMonthCursor } from "@/lib/useMonthCursor";
import { formatAmount, formatMonthYear } from "@/lib/format";
import type { Expense } from "@/lib/types";

const ARABIC_MONTHS_SHORT = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function isSpend(e: Expense) {
  return e.transaction_type === "purchase" || e.transaction_type === "bill_payment";
}

export default function ReportsPage() {
  const month = useMonthCursor();
  const [monthExpenses, setMonthExpenses] = useState<Expense[]>([]);
  const [trendExpenses, setTrendExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/expenses?from=${month.firstOfMonth}&to=${month.lastOfMonth}`)
      .then((r) => r.json())
      .then((data) => setMonthExpenses(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [month.firstOfMonth, month.lastOfMonth]);

  useEffect(() => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const from = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-01`;
    fetch(`/api/expenses?from=${from}`)
      .then((r) => r.json())
      .then((data) => setTrendExpenses(Array.isArray(data) ? data : []));
  }, []);

  const totalThisMonth = monthExpenses.filter(isSpend).reduce((s, e) => s + parseFloat(e.amount), 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthExpenses.filter(isSpend)) {
      const key = e.category_name ?? "بدون تصنيف";
      map.set(key, (map.get(key) ?? 0) + parseFloat(e.amount));
    }
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount, pct: total > 0 ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthExpenses]);

  const trend = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      buckets.push({ key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: ARABIC_MONTHS_SHORT[d.getUTCMonth()], total: 0 });
    }
    for (const e of trendExpenses.filter(isSpend)) {
      const d = new Date(e.date);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      const bucket = buckets.find((b) => b.key === key);
      if (bucket) bucket.total += parseFloat(e.amount);
    }
    const max = Math.max(1, ...buckets.map((b) => b.total));
    return buckets.map((b) => ({ ...b, heightPct: Math.max(4, (b.total / max) * 100) }));
  }, [trendExpenses]);

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-3.5 pb-1.5">
        <div className="text-[22px] font-bold">التقارير</div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => month.setOffset(month.offset - 1)} className="p-1 text-ink-muted">
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </button>
          <span className="text-sm font-semibold">{formatMonthYear(month.firstOfMonth)}</span>
          <button
            onClick={() => month.setOffset(month.offset + 1)}
            disabled={month.offset >= 0}
            className="p-1 text-ink-muted disabled:opacity-30"
          >
            <ChevronLeftIcon />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-2.5 pb-5.5">
          <div className="text-[13px] text-ink-muted mb-1">إجمالي المصروفات</div>
          <div className="text-[32px] font-bold tabular-nums tracking-tight">
            {formatAmount(totalThisMonth)} <span className="text-base font-medium text-ink-muted">ر.س</span>
          </div>
        </div>

        <div className="px-4 pb-6">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide px-1 pb-2">آخر 6 أشهر</div>
          <div className="bg-surface rounded-[10px] pt-4.5 px-4 pb-3">
            <div className="flex items-end gap-2.5 h-[100px]">
              {trend.map((b, i) => (
                <div key={b.key} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className={`w-full max-w-[26px] rounded-[3px] ${i === trend.length - 1 ? "bg-primary" : "bg-fill"}`}
                    style={{ height: `${b.heightPct}%` }}
                  />
                  <span
                    className={`text-[10.5px] ${i === trend.length - 1 ? "font-semibold text-ink" : "text-ink-faint"}`}
                  >
                    {b.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 pb-6">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide px-1 pb-2">حسب التصنيف</div>
          <div className="bg-surface rounded-[10px] overflow-hidden">
            {loading && <div className="p-4 text-sm text-ink-muted text-center">جارٍ التحميل...</div>}
            {!loading && byCategory.length === 0 && (
              <div className="p-4 text-sm text-ink-muted text-center">لا توجد بيانات لهذا الشهر</div>
            )}
            {byCategory.map((c, i) => (
              <div key={c.name}>
                <div className="px-3.5 py-2.5">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-[14.5px]">{c.name}</span>
                    <span className="text-[13.5px] text-ink-muted tabular-nums">
                      {formatAmount(c.amount)} ر.س &middot; {Math.round(c.pct)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-fill overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
                {i < byCategory.length - 1 && <div className="h-px bg-separator mr-3.5" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </>
  );
}
