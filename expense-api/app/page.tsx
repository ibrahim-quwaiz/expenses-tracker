"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import StoreAvatar from "@/components/StoreAvatar";
import { PlusIcon, ChevronRightIcon, ChevronLeftIcon } from "@/components/icons";
import { useMonthCursor } from "@/lib/useMonthCursor";
import { formatAmount, formatMonthYear, relativeDayLabel, formatTime } from "@/lib/format";
import type { BudgetStatus, Expense } from "@/lib/types";

export default function HomePage() {
  const month = useMonthCursor();
  const [budgetRows, setBudgetRows] = useState<BudgetStatus[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/budget-status?month=${month.firstOfMonth}`).then((r) => r.json()),
      fetch(`/api/expenses?from=${month.firstOfMonth}&to=${month.lastOfMonth}`).then((r) => r.json()),
    ])
      .then(([budgets, exp]) => {
        if (cancelled) return;
        setBudgetRows(Array.isArray(budgets) ? budgets : []);
        setExpenses(Array.isArray(exp) ? exp : []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [month.firstOfMonth, month.lastOfMonth]);

  const totalSpentThisMonth = expenses
    .filter((e) => e.transaction_type === "purchase" || e.transaction_type === "bill_payment")
    .reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalBudget = budgetRows.reduce((s, b) => s + parseFloat(b.amount_limit), 0);
  const totalRemaining = totalBudget - budgetRows.reduce((s, b) => s + parseFloat(b.spent), 0);

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
        <Link
          href="/add"
          aria-label="إضافة مصروف"
          className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center"
        >
          <PlusIcon />
        </Link>
        <div className="flex items-center gap-2">
          <button
            aria-label="الشهر السابق"
            onClick={() => month.setOffset(month.offset - 1)}
            className="p-1.5 text-ink-muted"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
          <span className="text-[15px] font-semibold min-w-[92px] text-center">
            {formatMonthYear(month.firstOfMonth)}
          </span>
          <button
            aria-label="الشهر التالي"
            onClick={() => month.setOffset(month.offset + 1)}
            disabled={month.offset >= 0}
            className="p-1.5 text-ink-muted disabled:opacity-30"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-2 pb-5">
          <div className="text-[13px] text-ink-muted mb-1">إجمالي المصروفات هذا الشهر</div>
          <div className="text-[38px] font-bold tabular-nums tracking-tight">
            {formatAmount(totalSpentThisMonth)} <span className="text-lg font-medium text-ink-muted">ر.س</span>
          </div>
          {totalBudget > 0 && (
            <div className="flex items-center gap-2.5 mt-2.5 text-[13px] text-ink-muted">
              <span>
                الميزانية <b className="text-ink font-semibold tabular-nums">{formatAmount(totalBudget)}</b>
              </span>
              <span className="w-px h-3 bg-separator" />
              <span>
                المتبقي{" "}
                <b className={`font-semibold tabular-nums ${totalRemaining < 0 ? "text-danger" : "text-success"}`}>
                  {formatAmount(totalRemaining)}
                </b>
              </span>
            </div>
          )}
        </div>

        {budgetRows.length > 0 && (
          <div className="px-4 pb-2">
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide px-1 pb-2">
              حسب التصنيف
            </div>
            <div className="bg-surface rounded-[10px] overflow-hidden">
              {budgetRows.map((b, i) => {
                const spent = parseFloat(b.spent);
                const limit = parseFloat(b.amount_limit);
                const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
                const over = spent > limit;
                const near = !over && limit > 0 && spent / limit >= 0.8;
                const barColor = over ? "bg-danger" : near ? "bg-warning" : "bg-success";
                const textColor = over ? "text-danger" : "text-ink";
                return (
                  <div key={b.budget_id}>
                    <div className="px-3.5 py-2.5">
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-[14.5px]">{b.category_name}</span>
                        <span className={`text-sm tabular-nums ${textColor}`}>
                          {formatAmount(spent)} ر.س
                        </span>
                      </div>
                      <div className="h-[3px] rounded-full bg-fill overflow-hidden">
                        <div className={`h-full ${barColor}`} style={{ width: `${over ? 100 : pct}%` }} />
                      </div>
                    </div>
                    {i < budgetRows.length - 1 && <div className="h-px bg-separator mr-3.5" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-4 pt-5 pb-6">
          <div className="flex items-center justify-between px-1 pb-2">
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide">آخر العمليات</div>
            <Link href="/transactions" className="text-[13px] font-medium text-primary">
              عرض الكل
            </Link>
          </div>
          <div className="bg-surface rounded-[10px] overflow-hidden">
            {loading && <div className="p-4 text-sm text-ink-muted text-center">جارٍ التحميل...</div>}
            {!loading && expenses.length === 0 && (
              <div className="p-4 text-sm text-ink-muted text-center">لا توجد عمليات هذا الشهر</div>
            )}
            {expenses.slice(0, 5).map((e, i, arr) => (
              <div key={e.id}>
                <Link href={`/transactions/${e.id}`} className="flex items-center gap-3 px-3.5 py-2.5">
                  <StoreAvatar name={e.store_name} logoUrl={e.store_logo_url} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14.5px] font-medium truncate">{e.store_name ?? "بدون جهة"}</div>
                    <div className="text-xs text-ink-muted mt-0.5 truncate">
                      {e.category_name ?? "بدون تصنيف"} &middot; {relativeDayLabel(e.date)}
                      {relativeDayLabel(e.date) === "اليوم" ? ` ${formatTime(e.created_at)}` : ""}
                    </div>
                  </div>
                  <div className="text-[14.5px] tabular-nums flex-shrink-0">{formatAmount(e.amount)} ر.س</div>
                </Link>
                {i < arr.length - 1 && <div className="h-px bg-separator mr-[60px]" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </>
  );
}
