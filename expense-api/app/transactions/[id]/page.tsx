"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRightIcon, CameraIcon } from "@/components/icons";
import StoreAvatar from "@/components/StoreAvatar";
import { formatAmount, formatDayMonthYear, formatTime } from "@/lib/format";
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  async function handleLogoSelected(file: File | undefined) {
    if (!file || !expense?.store_id) return;
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/stores/${expense.store_id}/logo`, { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "تعذر رفع الشعار");
      setExpense((prev) => (prev ? { ...prev, store_logo_url: body.logo_url } : prev));
    } catch (e: any) {
      setUploadError(e.message ?? "حدث خطأ غير متوقع");
    } finally {
      setUploading(false);
    }
  }

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
              <div className="relative w-[52px] h-[52px] mx-auto mb-3.5">
                <StoreAvatar name={expense.store_name} logoUrl={expense.store_logo_url} size={52} />
                {expense.store_id && (
                  <label className="absolute -bottom-0.5 -left-0.5 w-[22px] h-[22px] rounded-full bg-primary text-white flex items-center justify-center border-2 border-bg cursor-pointer">
                    <CameraIcon />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => handleLogoSelected(e.target.files?.[0])}
                    />
                  </label>
                )}
              </div>
              <div className="text-[30px] font-bold tabular-nums tracking-tight">
                {formatAmount(expense.amount)} <span className="text-sm font-medium text-ink-muted">ر.س</span>
              </div>
              <div className="text-[14.5px] text-ink-muted mt-1">{expense.store_name ?? "بدون جهة"}</div>
              {uploading && <div className="text-xs text-ink-muted mt-1">جارٍ رفع الشعار...</div>}
              {uploadError && <div className="text-xs text-danger mt-1">{uploadError}</div>}
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
                    {formatDayMonthYear(expense.date)}، {formatTime(expense.date)}
                  </span>
                </div>
                <div className="h-px bg-separator mr-3.5" />
                <div className="flex items-center justify-between px-3.5 py-3">
                  <span className="text-[14.5px] text-ink-muted">نوع العملية</span>
                  <span className="text-[14.5px]">{TRANSACTION_TYPE_LABELS[expense.transaction_type]}</span>
                </div>
                <div className="h-px bg-separator mr-3.5" />
                <div className="flex items-center justify-between px-3.5 py-3">
                  <span className="text-[14.5px] text-ink-muted">الحساب</span>
                  <span className="text-[14.5px]">{expense.account_name ?? "بدون حساب"}</span>
                </div>
                <div className="h-px bg-separator mr-3.5" />
                <div className="flex items-center justify-between px-3.5 py-3">
                  <span className="text-[14.5px] text-ink-muted">وسيلة الدفع</span>
                  <span className="text-[14.5px]">{expense.payment_method ?? "غير محددة"}</span>
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
