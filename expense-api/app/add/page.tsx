"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { findOrCreateStore } from "@/lib/stores";
import { formatAmount } from "@/lib/format";
import type { Category, TransactionType } from "@/lib/types";
import { TRANSACTION_TYPE_LABELS } from "@/lib/types";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AddExpensePage() {
  const router = useRouter();
  const [tab, setTab] = useState<"manual" | "sms">("manual");
  const [categories, setCategories] = useState<Category[]>([]);

  // shared, editable fields (used by both the manual form and the reviewed SMS result)
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [transactionType, setTransactionType] = useState<TransactionType>("purchase");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // sms tab: pre-review state
  const [smsText, setSmsText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [rawSmsHash, setRawSmsHash] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((cats) => {
        setCategories(Array.isArray(cats) ? cats : []);
        setCategoryId((prev) => prev || cats?.[0]?.id || "");
      });
  }, []);

  async function analyzeSms() {
    if (!smsText.trim()) return setSmsError("الصق نص الرسالة أولًا");
    setAnalyzing(true);
    setSmsError(null);
    try {
      const res = await fetch("/api/expenses/parse-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sms_text: smsText }),
      });
      const body = await res.json();
      if (res.status === 409) throw new Error("تم معالجة هذه الرسالة مسبقًا");
      if (!res.ok) throw new Error(body.error ?? "تعذر تحليل الرسالة");

      setAmount(String(body.extracted.amount));
      setMerchant(body.extracted.merchant);
      setDate(body.extracted.date);
      setTransactionType(body.extracted.transaction_type);
      setCategoryId(body.matched_category_id ?? categoryId);
      setRawSmsHash(body.raw_sms_hash);
    } catch (e: any) {
      setSmsError(e.message ?? "حدث خطأ غير متوقع");
    } finally {
      setAnalyzing(false);
    }
  }

  function resetSmsAnalysis() {
    setRawSmsHash(null);
    setSmsText("");
    setSmsError(null);
  }

  async function save() {
    setError(null);
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return setError("أدخل مبلغًا صحيحًا");
    if (!merchant.trim()) return setError("أدخل اسم التاجر");
    if (!categoryId) return setError("اختر التصنيف");

    setSaving(true);
    try {
      const storeId = await findOrCreateStore(merchant.trim());

      const isFromSms = tab === "sms" && rawSmsHash;
      const url = isFromSms ? "/api/expenses/parse-sms/confirm" : "/api/expenses";
      const payload: Record<string, unknown> = {
        amount: amountNum,
        description: notes.trim() || null,
        date,
        category_id: categoryId,
        store_id: storeId,
        transaction_type: transactionType,
      };
      if (isFromSms) payload.raw_sms_hash = rawSmsHash;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409) throw new Error("تم معالجة هذه الرسالة مسبقًا");
        throw new Error(body.error ?? "تعذر حفظ المصروف");
      }
      router.push("/");
    } catch (e: any) {
      setError(e.message ?? "حدث خطأ غير متوقع");
    } finally {
      setSaving(false);
    }
  }

  const showFields = tab === "manual" || rawSmsHash !== null;
  const canSave = tab === "manual" || rawSmsHash !== null;

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-separator">
        <Link href="/" className="text-[15px] text-primary">
          إلغاء
        </Link>
        <div className="text-[15px] font-semibold">مصروف جديد</div>
        {canSave ? (
          <button onClick={save} disabled={saving} className="text-[15px] font-bold text-primary disabled:opacity-40">
            {saving ? "..." : "حفظ"}
          </button>
        ) : (
          <span className="w-8" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="pt-6 pb-1.5 text-center">
          <div className="text-[44px] font-bold tabular-nums tracking-tighter">
            {formatAmount(amount || "0")} <span className="text-xl font-medium text-ink-muted">ر.س</span>
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

        {tab === "sms" && !rawSmsHash && (
          <div className="px-4 pt-4.5 pb-2">
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
          </div>
        )}

        {tab === "sms" && rawSmsHash && (
          <div className="px-4 pt-3 pb-1 flex items-center justify-between">
            <div className="text-xs text-ink-muted">تم التحليل — راجع البيانات وعدّلها إذا لزم قبل الحفظ</div>
            <button onClick={resetSmsAnalysis} className="text-xs font-semibold text-primary flex-shrink-0">
              تحليل رسالة أخرى
            </button>
          </div>
        )}

        {showFields && (
          <div className="px-4 pt-3.5 pb-6">
            <div className="bg-surface rounded-[10px] overflow-hidden">
              <div className="flex items-center px-3.5 py-3">
                <label htmlFor="fAmount" className="w-[88px] flex-shrink-0 text-[14.5px]">
                  المبلغ
                </label>
                <input
                  id="fAmount"
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
                <label htmlFor="fMerchant" className="w-[88px] flex-shrink-0 text-[14.5px]">
                  التاجر
                </label>
                <input
                  id="fMerchant"
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="اسم الجهة"
                  className="flex-1 border-none bg-transparent text-[14.5px] text-ink text-right outline-none"
                />
              </div>
              <div className="h-px bg-separator mr-3.5" />
              <div className="flex items-center justify-between px-3.5 py-3">
                <label htmlFor="fCategory" className="text-[14.5px]">
                  التصنيف
                </label>
                <select
                  id="fCategory"
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
                <label htmlFor="fType" className="text-[14.5px]">
                  نوع العملية
                </label>
                <select
                  id="fType"
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
                <label htmlFor="fDate" className="text-[14.5px]">
                  التاريخ
                </label>
                <input
                  id="fDate"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent text-[14.5px] text-ink-muted text-right border-none outline-none"
                />
              </div>
            </div>

            <div className="bg-surface rounded-[10px] overflow-hidden mt-5">
              <div className="flex items-center px-3.5 py-3">
                <label htmlFor="fNotes" className="w-[88px] flex-shrink-0 text-[14.5px] text-ink-muted">
                  ملاحظات
                </label>
                <input
                  id="fNotes"
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
      </div>
    </>
  );
}
