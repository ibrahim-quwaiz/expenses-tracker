"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { findOrCreateStore } from "@/lib/stores";
import { formatAmount } from "@/lib/format";
import type { Category, TransactionType } from "@/lib/types";
import { TRANSACTION_TYPE_LABELS } from "@/lib/types";

const todayISO = () => new Date().toISOString().slice(0, 10);

type SmsItem = {
  key: string;
  amount: string;
  merchant: string;
  categoryId: string;
  transactionType: TransactionType;
  date: string;
  notes: string;
  rawSmsHash: string;
  duplicate: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
};

export default function AddExpensePage() {
  const router = useRouter();
  const [tab, setTab] = useState<"manual" | "sms">("manual");
  const [categories, setCategories] = useState<Category[]>([]);

  // manual tab
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [transactionType, setTransactionType] = useState<TransactionType>("purchase");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // sms tab
  const [smsText, setSmsText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [smsItems, setSmsItems] = useState<SmsItem[]>([]);
  const [savingAll, setSavingAll] = useState(false);

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
          transaction_type: transactionType,
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
    try {
      const res = await fetch("/api/expenses/parse-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sms_text: smsText }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "تعذر تحليل الرسالة");

      const items: SmsItem[] = body.results.map((r: any) => ({
        key: r.raw_sms_hash,
        amount: String(r.extracted.amount),
        merchant: r.extracted.merchant,
        categoryId: r.matched_category_id ?? categories[0]?.id ?? "",
        transactionType: r.extracted.transaction_type,
        date: r.extracted.date,
        notes: "",
        rawSmsHash: r.raw_sms_hash,
        duplicate: r.duplicate,
        saving: false,
        saved: false,
        error: null,
      }));
      setSmsItems(items);
    } catch (e: any) {
      setSmsError(e.message ?? "حدث خطأ غير متوقع");
    } finally {
      setAnalyzing(false);
    }
  }

  function resetSmsAnalysis() {
    setSmsItems([]);
    setSmsText("");
    setSmsError(null);
  }

  function updateItem(key: string, patch: Partial<SmsItem>) {
    setSmsItems((items) => items.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function removeItem(key: string) {
    setSmsItems((items) => items.filter((it) => it.key !== key));
  }

  async function saveItem(item: SmsItem): Promise<boolean> {
    const amountNum = parseFloat(item.amount);
    if (!amountNum || amountNum <= 0) {
      updateItem(item.key, { error: "أدخل مبلغًا صحيحًا" });
      return false;
    }
    if (!item.merchant.trim()) {
      updateItem(item.key, { error: "أدخل اسم التاجر" });
      return false;
    }
    updateItem(item.key, { saving: true, error: null });
    try {
      const storeId = await findOrCreateStore(item.merchant.trim());
      const res = await fetch("/api/expenses/parse-sms/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          description: item.notes.trim() || null,
          date: item.date,
          category_id: item.categoryId || null,
          store_id: storeId,
          transaction_type: item.transactionType,
          raw_sms_hash: item.rawSmsHash,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409) {
          updateItem(item.key, { saving: false, duplicate: true, error: "تم معالجة هذه الرسالة مسبقًا" });
          return false;
        }
        throw new Error(body.error ?? "تعذر حفظ المصروف");
      }
      updateItem(item.key, { saving: false, saved: true });
      return true;
    } catch (e: any) {
      updateItem(item.key, { saving: false, error: e.message ?? "حدث خطأ غير متوقع" });
      return false;
    }
  }

  async function saveAll() {
    setSavingAll(true);
    const pending = smsItems.filter((it) => !it.saved && !it.duplicate);
    let allOk = true;
    for (const item of pending) {
      const ok = await saveItem(item);
      if (!ok) allOk = false;
    }
    setSavingAll(false);
    if (allOk) router.push("/");
  }

  const pendingCount = smsItems.filter((it) => !it.saved && !it.duplicate).length;

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-separator">
        <Link href="/" className="text-[15px] text-primary">
          إلغاء
        </Link>
        <div className="text-[15px] font-semibold">مصروف جديد</div>
        {tab === "manual" && (
          <button onClick={saveManual} disabled={saving} className="text-[15px] font-bold text-primary disabled:opacity-40">
            {saving ? "..." : "حفظ"}
          </button>
        )}
        {tab === "sms" && pendingCount > 0 && (
          <button
            onClick={saveAll}
            disabled={savingAll}
            className="text-[15px] font-bold text-primary disabled:opacity-40"
          >
            {savingAll ? "..." : `حفظ الكل (${pendingCount})`}
          </button>
        )}
        {tab === "sms" && pendingCount === 0 && <span className="w-8" />}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "manual" && (
          <div className="pt-6 pb-1.5 text-center">
            <div className="text-[44px] font-bold tabular-nums tracking-tighter">
              {formatAmount(amount || "0")} <span className="text-xl font-medium text-ink-muted">ر.س</span>
            </div>
          </div>
        )}

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
          <div className="px-4 pt-3.5 pb-6">
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
                <label htmlFor="mType" className="text-[14.5px]">
                  نوع العملية
                </label>
                <select
                  id="mType"
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

        {tab === "sms" && smsItems.length === 0 && (
          <div className="px-4 pt-4.5 pb-2">
            <div className="bg-surface rounded-[10px] p-3.5 mb-3.5">
              <textarea
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                placeholder="الصق رسالة واحدة أو أكثر هنا (يمكنك لصق عدة رسائل معًا)..."
                className="w-full h-28 resize-none border-none text-sm text-ink leading-7 outline-none"
              />
            </div>
            <button
              onClick={analyzeSms}
              disabled={analyzing}
              className="w-full rounded-[10px] py-3.5 text-[14.5px] font-semibold text-white bg-primary disabled:opacity-50"
            >
              {analyzing ? "جارٍ التحليل..." : "تحليل الرسائل"}
            </button>
            {smsError && <div className="text-sm text-danger text-center mt-4">{smsError}</div>}
          </div>
        )}

        {tab === "sms" && smsItems.length > 0 && (
          <div className="px-4 pt-3 pb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-ink-muted">
                تم استخراج {smsItems.length} عملية — راجعها وعدّلها قبل الحفظ
              </div>
              <button onClick={resetSmsAnalysis} className="text-xs font-semibold text-primary flex-shrink-0">
                تحليل رسائل أخرى
              </button>
            </div>

            <div className="flex flex-col gap-3.5">
              {smsItems.map((item) => (
                <div key={item.key} className="bg-surface rounded-[10px] overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-separator">
                    <span className="text-lg font-bold tabular-nums">
                      {formatAmount(item.amount)} <span className="text-xs font-medium text-ink-muted">ر.س</span>
                    </span>
                    {item.saved ? (
                      <span className="text-xs font-semibold text-success">تم الحفظ ✓</span>
                    ) : item.duplicate ? (
                      <span className="text-xs font-semibold text-warning">مكررة — تم تجاهلها</span>
                    ) : (
                      <button
                        onClick={() => removeItem(item.key)}
                        className="text-xs font-medium text-ink-faint"
                      >
                        إزالة
                      </button>
                    )}
                  </div>

                  <fieldset disabled={item.saved || item.saving} className="disabled:opacity-60">
                    <div className="flex items-center px-3.5 py-2.5">
                      <label className="w-[88px] flex-shrink-0 text-[13.5px]">المبلغ</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.amount}
                        onChange={(e) => updateItem(item.key, { amount: e.target.value })}
                        className="flex-1 border-none bg-transparent text-[13.5px] text-ink text-right outline-none"
                      />
                    </div>
                    <div className="h-px bg-separator mr-3.5" />
                    <div className="flex items-center px-3.5 py-2.5">
                      <label className="w-[88px] flex-shrink-0 text-[13.5px]">التاجر</label>
                      <input
                        type="text"
                        value={item.merchant}
                        onChange={(e) => updateItem(item.key, { merchant: e.target.value })}
                        className="flex-1 border-none bg-transparent text-[13.5px] text-ink text-right outline-none"
                      />
                    </div>
                    <div className="h-px bg-separator mr-3.5" />
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <label className="text-[13.5px]">التصنيف</label>
                      <select
                        value={item.categoryId}
                        onChange={(e) => updateItem(item.key, { categoryId: e.target.value })}
                        className="bg-transparent text-[13.5px] text-ink-muted text-right border-none outline-none"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="h-px bg-separator mr-3.5" />
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <label className="text-[13.5px]">نوع العملية</label>
                      <select
                        value={item.transactionType}
                        onChange={(e) =>
                          updateItem(item.key, { transactionType: e.target.value as TransactionType })
                        }
                        className="bg-transparent text-[13.5px] text-ink-muted text-right border-none outline-none"
                      >
                        {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="h-px bg-separator mr-3.5" />
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <label className="text-[13.5px]">التاريخ</label>
                      <input
                        type="date"
                        value={item.date}
                        onChange={(e) => updateItem(item.key, { date: e.target.value })}
                        className="bg-transparent text-[13.5px] text-ink-muted text-right border-none outline-none"
                      />
                    </div>
                  </fieldset>

                  {!item.saved && !item.duplicate && (
                    <div className="px-3.5 py-2.5 border-t border-separator">
                      <button
                        onClick={() => saveItem(item)}
                        disabled={item.saving}
                        className="w-full rounded-lg py-2 text-[13px] font-semibold text-white bg-primary disabled:opacity-50"
                      >
                        {item.saving ? "جارٍ الحفظ..." : "حفظ هذه العملية"}
                      </button>
                      {item.error && <div className="text-xs text-danger text-center mt-2">{item.error}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
