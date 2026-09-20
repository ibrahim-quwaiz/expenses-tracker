"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { findOrCreateStore } from "@/lib/stores";
import { formatAmount } from "@/lib/format";
import type { Category } from "@/lib/types";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AddExpensePage() {
  const router = useRouter();
  const [tab, setTab] = useState<"manual" | "sms">("manual");
  const [categories, setCategories] = useState<Category[]>([]);

  // manual tab state
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // sms tab state
  const [smsText, setSmsText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [smsResult, setSmsResult] = useState<{
    amount: string;
    date: string;
    merchant: string;
    category_id: string | null;
  } | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((cats) => {
        setCategories(Array.isArray(cats) ? cats : []);
        setCategoryId((prev) => prev || cats?.[0]?.id || "");
      });
  }, []);

  async function saveManual() {
    setError(null);
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return setError("أدخل مبلغًا صحيحًا");
    if (!merchant.trim()) return setError("أدخل اسم التاجر");
    if (!categoryId) return setError("اختر التصنيف");

    setSaving(true);
    try {
      const storeId = await findOrCreateStore(merchant.trim());
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          description: notes.trim() || null,
          date,
          category_id: categoryId,
          store_id: storeId,
          transaction_type: "purchase",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "تعذر حفظ المصروف");
      }
      router.push("/");
    } catch (e: any) {
      setError(e.message ?? "حدث خطأ غير متوقع");
    } finally {
      setSaving(false);
    }
  }

  async function analyzeSms() {
    if (!smsText.trim()) return setSmsError("الصق نص الرسالة أولًا");
    setAnalyzing(true);
    setSmsError(null);
    setSmsResult(null);
    try {
      const res = await fetch("/api/expenses/parse-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sms_text: smsText }),
      });
      const body = await res.json();
      if (res.status === 409) {
        throw new Error("تم معالجة هذه الرسالة مسبقًا");
      }
      if (!res.ok) {
        throw new Error(body.error ?? "تعذر تحليل الرسالة");
      }
      setSmsResult({
        amount: body.expense.amount,
        date: body.expense.date,
        merchant: body.expense.description ?? "—",
        category_id: body.expense.category_id,
      });
    } catch (e: any) {
      setSmsError(e.message ?? "حدث خطأ غير متوقع");
    } finally {
      setAnalyzing(false);
    }
  }

  const heroAmount = tab === "manual" ? amount || "0" : smsResult?.amount ?? "0";
  const categoryName = smsResult?.category_id
    ? categories.find((c) => c.id === smsResult.category_id)?.name ?? "—"
    : "بدون تصنيف";

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-separator">
        <Link href="/" className="text-[15px] text-primary">
          إلغاء
        </Link>
        <div className="text-[15px] font-semibold">مصروف جديد</div>
        {tab === "manual" ? (
          <button
            onClick={saveManual}
            disabled={saving}
            className="text-[15px] font-bold text-primary disabled:opacity-40"
          >
            {saving ? "..." : "حفظ"}
          </button>
        ) : (
          <span className="w-8" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="pt-6 pb-1.5 text-center">
          <div className="text-[44px] font-bold tabular-nums tracking-tighter">
            {formatAmount(heroAmount)} <span className="text-xl font-medium text-ink-muted">ر.س</span>
          </div>
        </div>

        <div className="px-4 pt-4">
          <div className="flex bg-fill rounded-[9px] p-0.5">
            <button
              onClick={() => setTab("manual")}
              className={`flex-1 rounded-[7px] py-1.5 text-[13px] font-semibold ${
                tab === "manual" ? "bg-surface text-ink" : "text-ink-muted"
              }`}
            >
              يدوي
            </button>
            <button
              onClick={() => setTab("sms")}
              className={`flex-1 rounded-[7px] py-1.5 text-[13px] font-semibold ${
                tab === "sms" ? "bg-surface text-ink" : "text-ink-muted"
              }`}
            >
              لصق رسالة بنكية
            </button>
          </div>
        </div>

        {tab === "manual" && (
          <div className="px-4 pt-4.5 pb-6">
            <div className="bg-surface rounded-[10px] overflow-hidden">
              <div className="flex items-center px-3.5 py-3">
                <label htmlFor="mAmount" className="w-[88px] flex-shrink-0 text-[14.5px]">
                  المبلغ
                </label>
                <input
                  id="mAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 border-none bg-transparent text-[14.5px] text-ink text-right outline-none"
                />
              </div>
              <div className="h-px bg-separator mr-3.5" />
              <div className="flex items-center px-3.5 py-3">
                <label htmlFor="mMerchant" className="w-[88px] flex-shrink-0 text-[14.5px]">
                  التاجر
                </label>
                <input
                  id="mMerchant"
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="اسم الجهة"
                  className="flex-1 border-none bg-transparent text-[14.5px] text-ink text-right outline-none"
                />
              </div>
              <div className="h-px bg-separator mr-3.5" />
              <div className="flex items-center justify-between px-3.5 py-3">
                <label htmlFor="mCategory" className="text-[14.5px]">
                  التصنيف
                </label>
                <select
                  id="mCategory"
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
                <label htmlFor="mDate" className="text-[14.5px]">
                  التاريخ
                </label>
                <input
                  id="mDate"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent text-[14.5px] text-ink-muted text-right border-none outline-none"
                />
              </div>
            </div>

            <div className="bg-surface rounded-[10px] overflow-hidden mt-5">
              <div className="flex items-center px-3.5 py-3">
                <label htmlFor="mNotes" className="w-[88px] flex-shrink-0 text-[14.5px] text-ink-muted">
                  ملاحظات
                </label>
                <input
                  id="mNotes"
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
        )}

        {tab === "sms" && (
          <div className="px-4 pt-4.5 pb-6">
            <div className="bg-surface rounded-[10px] p-3.5 mb-3.5">
              <textarea
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                placeholder="الصق نص رسالة البنك هنا..."
                className="w-full h-24 resize-none border-none text-sm text-ink leading-7 outline-none"
              />
            </div>

            <button
              onClick={analyzeSms}
              disabled={analyzing}
              className="w-full rounded-[10px] py-3.5 text-[14.5px] font-semibold text-white bg-primary disabled:opacity-50"
            >
              {analyzing ? "جارٍ التحليل..." : "تحليل الرسالة"}
            </button>

            {smsError && <div className="text-sm text-danger text-center mt-4">{smsError}</div>}

            {smsResult && (
              <div className="bg-surface rounded-[10px] overflow-hidden mt-4">
                <div className="flex items-center justify-between px-3.5 py-3">
                  <span className="text-[14.5px] text-ink-muted">التاريخ</span>
                  <span className="text-[14.5px] tabular-nums">{smsResult.date}</span>
                </div>
                <div className="h-px bg-separator mr-3.5" />
                <div className="flex items-center justify-between px-3.5 py-3">
                  <span className="text-[14.5px] text-ink-muted">الجهة</span>
                  <span className="text-[14.5px]">{smsResult.merchant}</span>
                </div>
                <div className="h-px bg-separator mr-3.5" />
                <div className="flex items-center justify-between px-3.5 py-3">
                  <span className="text-[14.5px] text-ink-muted">التصنيف</span>
                  <span className="text-[14.5px]">{categoryName}</span>
                </div>
                <div className="h-px bg-separator mr-3.5" />
                <div className="flex items-center justify-between px-3.5 py-3">
                  <span className="text-[14.5px] text-ink-muted">المبلغ</span>
                  <span className="text-base font-bold tabular-nums">{formatAmount(smsResult.amount)} ر.س</span>
                </div>
              </div>
            )}

            {smsResult && (
              <div className="mt-4 text-center">
                <div className="text-sm text-success font-medium mb-3">✓ تمت إضافة العملية للسجل</div>
                <Link href="/" className="text-[14.5px] font-semibold text-primary">
                  الرجوع للرئيسية
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
