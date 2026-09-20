"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { formatAmount, formatDayMonthYear, formatTime, initial } from "@/lib/format";
import { TRANSACTION_TYPE_LABELS } from "@/lib/types";
import type { Expense } from "@/lib/types";

const SOURCE_LABELS: Record<string, string> = {
  manual: "إدخال يدوي",
  sms_paste: "رسالة بنكية",
};

export default function TransactionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/expenses/${id}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((data) => data && setExpense(data))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!confirm("هل تريد حذف هذه الحركة؟")) return;
    setDeleting(true);
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/transactions");
    } else {
      setDeleting(false);
      alert("تعذر حذف الحركة");
    }
  }

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-separator">
        <Link href="/transactions" className="flex items-center gap-0.5 text-primary text-[15px]">
          <ChevronRightIcon />
          الحركات
        </Link>
        {expense && (
          <Link href={`/transactions/${id}/edit`} className="text-[15px] text-primary">
            تعديل
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <div className="text-sm text-ink-muted text-center py-10">جارٍ التحميل...</div>}
        {notFound && <div className="text-sm text-ink-muted text-center py-10">لم يتم العثور على الحركة</div>}

        {expense && (
          <>
            <div className="pt-6.5 pb-5.5 text-center px-4">
              <div className="w-[52px] h-[52px] rounded-full bg-fill text-[#48484A] flex items-center justify-center font-semibold text-lg mx-auto mb-3.5">
                {initial(expense.store_name)}
              </div>
              <div className="text-[30px] font-bold tabular-nums tracking-tight">
                {formatAmount(expense.amount)} <span className="text-sm font-medium text-ink-muted">ر.س</span>
              </div>
              <div className="text-[14.5px] text-ink-muted mt-1">{expense.store_name ?? "بدون جهة"}</div>
            </div>

            <div className="px-4 pb-5">
              <div className="bg-surface rounded-[10px] overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-3">
                  <span className="text-[14.5px] text-ink-muted">التصنيف</span>
                  <span className="text-[14.5px]">{expense.category_name ?? "بدون تصنيف"}</span>
                </div>
                <div className="h-px bg-separator mr-3.5" />
                <div className="flex items-center justify-between px-3.5 py-3">
                  <span className="text-[14.5px] text-ink-muted">التاريخ والوقت</span>
                  <span className="text-[14.5px] tabular-nums">
                    {formatDayMonthYear(expense.date)}، {formatTime(expense.created_at)}
                  </span>
                </div>
                <div className="h-px bg-separator mr-3.5" />
                <div className="flex items-center justify-between px-3.5 py-3">
                  <span className="text-[14.5px] text-ink-muted">نوع العملية</span>
                  <span className="text-[14.5px]">{TRANSACTION_TYPE_LABELS[expense.transaction_type]}</span>
                </div>
                <div className="h-px bg-separator mr-3.5" />
                <div className="flex items-center justify-between px-3.5 py-3">
                  <span className="text-[14.5px] text-ink-muted">المصدر</span>
                  <span className="text-[14.5px]">{SOURCE_LABELS[expense.source] ?? expense.source}</span>
                </div>
                <div className="h-px bg-separator mr-3.5" />
                <div className="px-3.5 py-3">
                  <div className="text-xs text-ink-muted mb-1">ملاحظات</div>
                  <div className="text-sm text-ink-faint">{expense.description || "لا توجد ملاحظات"}</div>
                </div>
              </div>
            </div>

            <div className="px-4">
              <div className="bg-surface rounded-[10px] overflow-hidden">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full border-none bg-transparent py-3.5 text-[14.5px] font-medium text-danger text-center disabled:opacity-50"
                >
                  {deleting ? "جارٍ الحذف..." : "حذف الحركة"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
