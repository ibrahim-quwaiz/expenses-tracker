"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { findOrCreateStore } from "@/lib/stores";
import { formatAmount } from "@/lib/format";
import type { Category, Expense, TransactionType } from "@/lib/types";
import { TRANSACTION_TYPE_LABELS } from "@/lib/types";

export default function EditTransactionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [transactionType, setTransactionType] = useState<TransactionType>("purchase");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/expenses/${id}`).then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([exp, cats]: [Expense, Category[]]) => {
      setCategories(Array.isArray(cats) ? cats : []);
      setAmount(exp.amount);
      setMerchant(exp.store_name ?? "");
      setCategoryId(exp.category_id ?? cats?.[0]?.id ?? "");
      setTransactionType(exp.transaction_type);
      setDate(exp.date.slice(0, 10));
      setNotes(exp.description ?? "");
      setLoading(false);
    });
  }, [id]);

  async function save() {
    setError(null);
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return setError("أدخل مبلغًا صحيحًا");
    if (!merchant.trim()) return setError("أدخل اسم التاجر");

    setSaving(true);
    try {
      const storeId = await findOrCreateStore(merchant.trim());
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          description: notes.trim() || null,
          date,
          category_id: categoryId || null,
          store_id: storeId,
          transaction_type: transactionType,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "تعذر حفظ التعديل");
      }
      router.push(`/transactions/${id}`);
    } catch (e: any) {
      setError(e.message ?? "حدث خطأ غير متوقع");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-separator">
        <Link href={`/transactions/${id}`} className="text-[15px] text-primary">
          إلغاء
        </Link>
        <div className="text-[15px] font-semibold">تعديل الحركة</div>
        <button onClick={save} disabled={saving} className="text-[15px] font-bold text-primary disabled:opacity-40">
          {saving ? "..." : "حفظ"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-sm text-ink-muted text-center py-10">جارٍ التحميل...</div>
        ) : (
          <>
            <div className="pt-6 pb-1.5 text-center">
              <div className="text-[44px] font-bold tabular-nums tracking-tighter">
                {formatAmount(amount || "0")} <span className="text-xl font-medium text-ink-muted">ر.س</span>
              </div>
            </div>

            <div className="px-4 pt-4.5 pb-6">
              <div className="bg-surface rounded-[10px] overflow-hidden">
                <div className="flex items-center px-3.5 py-3">
                  <label htmlFor="eAmount" className="w-[88px] flex-shrink-0 text-[14.5px]">
                    المبلغ
                  </label>
                  <input
                    id="eAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1 border-none bg-transparent text-[14.5px] text-ink text-right outline-none"
                  />
                </div>
                <div className="h-px bg-separator mr-3.5" />
                <div className="flex items-center px-3.5 py-3">
                  <label htmlFor="eMerchant" className="w-[88px] flex-shrink-0 text-[14.5px]">
                    التاجر
                  </label>
                  <input
                    id="eMerchant"
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    className="flex-1 border-none bg-transparent text-[14.5px] text-ink text-right outline-none"
                  />
                </div>
                <div className="h-px bg-separator mr-3.5" />
                <div className="flex items-center justify-between px-3.5 py-3">
                  <label htmlFor="eCategory" className="text-[14.5px]">
                    التصنيف
                  </label>
                  <select
                    id="eCategory"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="bg-transparent text-[14.5px] text-ink-muted text-right border-none outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="h-px bg-separator mr-3.5" />
                <div className="flex items-center justify-between px-3.5 py-3">
                  <label htmlFor="eType" className="text-[14.5px]">
                    نوع العملية
                  </label>
                  <select
                    id="eType"
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                    className="bg-transparent text-[14.5px] text-ink-muted text-right border-none outline-none"
                  >
                    {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="h-px bg-separator mr-3.5" />
                <div className="flex items-center justify-between px-3.5 py-3">
                  <label htmlFor="eDate" className="text-[14.5px]">
                    التاريخ
                  </label>
                  <input
                    id="eDate"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent text-[14.5px] text-ink-muted text-right border-none outline-none"
                  />
                </div>
              </div>

              <div className="bg-surface rounded-[10px] overflow-hidden mt-5">
                <div className="flex items-center px-3.5 py-3">
                  <label htmlFor="eNotes" className="w-[88px] flex-shrink-0 text-[14.5px] text-ink-muted">
                    ملاحظات
                  </label>
                  <input
                    id="eNotes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="اختياري"
                    className="flex-1 border-none bg-transparent text-[14.5px] text-ink text-right outline-none"
                  />
                </div>
              </div>

              {error && <div className="text-sm text-danger text-center mt-4">{error}</div>}
            </div>
          </>
        )}
      </div>
    </>
  );
}
