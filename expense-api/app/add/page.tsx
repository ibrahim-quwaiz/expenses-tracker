"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { findOrCreateStore } from "@/lib/stores";
import { formatAmount } from "@/lib/format";
import CategoryField from "@/components/CategoryField";
import TransferFields, { transferError } from "@/components/TransferFields";
import type { Account, Category, TransactionType } from "@/lib/types";
import { PAYMENT_METHODS, TRANSACTION_TYPE_LABELS } from "@/lib/types";

const todayISO = () => new Date().toISOString().slice(0, 10);
const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

type SmsItem = {
  key: string;
  amount: string;
  merchant: string;
  categoryId: string;
  accountId: string;
  paymentMethod: string;
  transactionType: TransactionType;
  date: string;
  time: string | null;
  notes: string;
  fee: number | null;
  accountNumberText: string | null;
  counterpartyAccountId: string | null;
  toAccountId: string;
  transferFee: string;
  pairedSmsHash: string | null;
  existingTransferId: string | null;
  ignoreExisting: boolean;
  rawSmsHash: string;
  duplicate: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
};

/** Still to be saved: not saved yet, not a repeat of a saved SMS or of a transfer already recorded. */
function isPending(it: SmsItem): boolean {
  return !it.saved && !it.duplicate && !(it.existingTransferId && !it.ignoreExisting);
}

export default function AddExpensePage() {
  const router = useRouter();
  const [tab, setTab] = useState<"manual" | "sms">("manual");
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);

  // manual tab
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [fee, setFee] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionType, setTransactionType] = useState<TransactionType>("purchase");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowHHMM());
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
      .then((cats) => setCategories(Array.isArray(cats) ? cats : []));
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((accs) => {
        const list = Array.isArray(accs) ? accs : [];
        setAccounts(list);
        setAccountId((prev) => prev || list?.[0]?.id || "");
        setAccountsLoaded(true);
      });
  }, []);

  async function saveManual() {
    setError(null);
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return setError("أدخل مبلغًا صحيحًا");
    const isTransfer = transactionType === "internal_transfer";
    if (!isTransfer && !merchant.trim()) return setError("أدخل اسم التاجر");
    if (!isTransfer && !categoryId) return setError("اختر التصنيف");
    if (!accountId) return setError("اختر الحساب");
    if (isTransfer) {
      const err = transferError(accountId, toAccountId, fee);
      if (err) return setError(err);
    }

    setSaving(true);
    try {
      const storeId = isTransfer ? null : await findOrCreateStore(merchant.trim());
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          description: notes.trim() || null,
          date,
          time: time || null,
          category_id: categoryId,
          store_id: storeId,
          account_id: accountId || null,
          to_account_id: isTransfer ? toAccountId : null,
          fee: isTransfer ? parseFloat(fee) || 0 : 0,
          payment_method: paymentMethod || null,
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

      const items: SmsItem[] = body.results.map((r: any) => {
        const fee: number | null = r.extracted.fee ?? null;
        const transfer = r.transfer;
        if (transfer) {
          // Between two of the user's accounts: one transfer debiting the sender, crediting the receiver.
          return {
            key: r.raw_sms_hash,
            amount: String(transfer.amount),
            merchant: r.extracted.merchant,
            categoryId: "",
            accountId: transfer.from_account_id ?? "",
            paymentMethod: "",
            transactionType: "internal_transfer",
            date: r.extracted.date,
            time: r.extracted.time ?? null,
            notes: "",
            fee: null,
            accountNumberText: r.account_number_text ?? null,
            counterpartyAccountId: r.counterparty_account_id ?? null,
            toAccountId: transfer.to_account_id ?? "",
            transferFee: transfer.fee > 0 ? String(transfer.fee) : "",
            pairedSmsHash: transfer.paired_sms_hash ?? null,
            existingTransferId: transfer.existing_transfer_id ?? null,
            ignoreExisting: false,
            rawSmsHash: r.raw_sms_hash,
            duplicate: r.duplicate,
            saving: false,
            saved: false,
            error: null,
          } satisfies SmsItem;
        }
        return {
          key: r.raw_sms_hash,
          amount: String(fee ? Math.round((r.extracted.amount + fee) * 100) / 100 : r.extracted.amount),
          merchant: r.extracted.merchant,
          categoryId: r.matched_category_id ?? "",
          // No silent default: an unrecognized account must be picked by hand.
          accountId: r.matched_account_id ?? "",
          paymentMethod: "",
          transactionType: r.extracted.transaction_type,
          date: r.extracted.date,
          time: r.extracted.time ?? null,
          notes: fee ? `شامل رسوم ${formatAmount(fee)} ر.س` : "",
          fee,
          accountNumberText: r.account_number_text ?? null,
          counterpartyAccountId: r.counterparty_account_id ?? null,
          toAccountId: "",
          transferFee: "",
          pairedSmsHash: null,
          existingTransferId: null,
          ignoreExisting: false,
          rawSmsHash: r.raw_sms_hash,
          duplicate: r.duplicate,
          saving: false,
          saved: false,
          error: null,
        };
      });
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
    const isTransfer = item.transactionType === "internal_transfer";
    if (!isTransfer && !item.merchant.trim()) {
      updateItem(item.key, { error: "أدخل اسم التاجر" });
      return false;
    }
    if (!item.accountId) {
      updateItem(item.key, { error: "اختر الحساب" });
      return false;
    }
    const err = isTransfer ? transferError(item.accountId, item.toAccountId, item.transferFee) : null;
    if (err) {
      updateItem(item.key, { error: err });
      return false;
    }
    updateItem(item.key, { saving: true, error: null });
    try {
      const storeId = isTransfer ? null : await findOrCreateStore(item.merchant.trim());
      const res = await fetch("/api/expenses/parse-sms/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          description: item.notes.trim() || null,
          date: item.date,
          time: item.time,
          category_id: item.categoryId || null,
          store_id: storeId,
          account_id: item.accountId || null,
          to_account_id: isTransfer ? item.toAccountId : null,
          fee: isTransfer ? parseFloat(item.transferFee) || 0 : 0,
          payment_method: item.paymentMethod || null,
          transaction_type: item.transactionType,
          raw_sms_hash: item.rawSmsHash,
          paired_sms_hash: isTransfer ? item.pairedSmsHash : null,
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
    const pending = smsItems.filter(isPending);
    let allOk = true;
    for (const item of pending) {
      const ok = await saveItem(item);
      if (!ok) allOk = false;
    }
    setSavingAll(false);
    if (allOk) router.push("/");
  }

  function transferHint(item: SmsItem): string {
    if (item.transactionType === "internal_transfer") {
      return item.pairedSmsHash
        ? "دمجت رسالتي الطرفين في عملية وحدة: تُخصم من الحساب المرسِل وتُضاف للمستلم، والفرق بين المبلغين محسوب كرسوم."
        : "تحويل بين حساباتك: يُخصم من الحساب المرسِل ويُضاف للمستلم بعملية وحدة. ولو لصقت رسالة الطرف الثاني لاحقًا، التطبيق يتعرّف إنها مسجّلة.";
    }
    const name = (id: string) => accounts.find((a) => a.id === id)?.name ?? "حساب آخر";
    const other = name(item.counterpartyAccountId!);
    const self = item.accountId ? name(item.accountId) : "هذا الحساب";
    const incoming = item.transactionType === "transfer_in" || item.transactionType === "refund";
    const [from, to] = incoming ? [other, self] : [self, other];
    return `تحويل بين حساباتك: من ${from} إلى ${to}. هذه العملية تسجّل طرف ${self} فقط — لو ما وصلتك رسالة ${other} سجّلها يدويًا.`;
  }

  const pendingCount = smsItems.filter(isPending).length;
  const manualTransfer = transactionType === "internal_transfer";

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-separator">
        <Link href="/" className="text-[15px] text-primary">
          إلغاء
        </Link>
        <div className="text-[15px] font-semibold">مصروف جديد</div>
        {tab === "manual" && (
          <button
            onClick={saveManual}
            disabled={saving || accounts.length === 0}
            className="text-[15px] font-bold text-primary disabled:opacity-40"
          >
            {saving ? "..." : "حفظ"}
          </button>
        )}
        {tab === "sms" && pendingCount > 0 && (
          <button
            onClick={saveAll}
            disabled={savingAll || accounts.length === 0}
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

        {accountsLoaded && accounts.length === 0 && (
          <div className="mx-4 mt-3.5 rounded-[10px] bg-warning/10 px-3.5 py-3 text-[13.5px] text-ink">
            لازم تضيف حساب بنكي أولًا قبل تسجيل أي مصروف —{" "}
            <Link href="/accounts" className="font-semibold text-primary">
              أضف حسابًا الآن
            </Link>
          </div>
        )}

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
              {!manualTransfer && (
                <>
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
                  <CategoryField
                    categories={categories}
                    value={categoryId}
                    onChange={setCategoryId}
                    merchant={merchant}
                    autoFill
                  />
                </>
              )}
              <div className="h-px bg-separator mr-3.5" />
              <div className="flex items-center justify-between px-3.5 py-3">
                <label htmlFor="mAccount" className="text-[14.5px]">
                  {manualTransfer ? "من حساب" : "الحساب"}
                </label>
                <select
                  id="mAccount"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="bg-transparent text-[14.5px] text-ink-muted text-right border-none outline-none"
                >
                  {!accountId && <option value="" disabled hidden>اختر الحساب</option>}
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              {manualTransfer && (
                <TransferFields
                  accounts={accounts}
                  fromAccountId={accountId}
                  toAccountId={toAccountId}
                  onToAccountChange={setToAccountId}
                  fee={fee}
                  onFeeChange={setFee}
                />
              )}
              {!manualTransfer && (
                <>
                  <div className="h-px bg-separator mr-3.5" />
                  <div className="flex items-center justify-between px-3.5 py-3">
                    <label htmlFor="mPaymentMethod" className="text-[14.5px]">
                      وسيلة الدفع
                    </label>
                    <select
                      id="mPaymentMethod"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="bg-transparent text-[14.5px] text-ink-muted text-right border-none outline-none"
                    >
                      <option value="">غير محددة</option>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
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
              <div className="h-px bg-separator mr-3.5" />
              <div className="flex items-center justify-between px-3.5 py-3">
                <label htmlFor="mTime" className="text-[14.5px]">
                  الوقت
                </label>
                <input
                  id="mTime"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-transparent text-[14.5px] text-ink-muted text-right border-none outline-none tabular-nums"
                  dir="ltr"
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
                    ) : item.existingTransferId && !item.ignoreExisting ? (
                      <span className="text-xs font-semibold text-warning">مسجّل مسبقًا — تم تجاهله</span>
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
                    {item.fee !== null && item.transactionType !== "internal_transfer" && (
                      <div className="px-3.5 pb-2 -mt-1 text-[11.5px] text-ink-faint">
                        يشمل رسوم {formatAmount(item.fee)} ر.س
                      </div>
                    )}
                    {item.transactionType !== "internal_transfer" && (
                      <>
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
                        <CategoryField
                          categories={categories}
                          value={item.categoryId}
                          onChange={(id) => updateItem(item.key, { categoryId: id })}
                          merchant={item.merchant}
                          autoFill
                          compact
                        />
                      </>
                    )}
                    <div className="h-px bg-separator mr-3.5" />
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <label className="text-[13.5px]">
                        {item.transactionType === "internal_transfer" ? "من حساب" : "الحساب"}
                      </label>
                      <select
                        value={item.accountId}
                        onChange={(e) => updateItem(item.key, { accountId: e.target.value })}
                        className="bg-transparent text-[13.5px] text-ink-muted text-right border-none outline-none"
                      >
                        {!item.accountId && <option value="" disabled hidden>اختر الحساب</option>}
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!item.accountId && (
                      <div className="px-3.5 pb-2.5 -mt-1 text-[11.5px] text-warning">
                        ما تعرّفت على الحساب
                        {item.accountNumberText && <> (الرقم بالرسالة: <span dir="ltr">{item.accountNumberText}</span>)</>}
                        {" "}— اختره يدويًا
                      </div>
                    )}
                    {item.transactionType === "internal_transfer" && (
                      <TransferFields
                        accounts={accounts}
                        fromAccountId={item.accountId}
                        toAccountId={item.toAccountId}
                        onToAccountChange={(id) => updateItem(item.key, { toAccountId: id })}
                        fee={item.transferFee}
                        onFeeChange={(v) => updateItem(item.key, { transferFee: v })}
                        compact
                      />
                    )}
                    {(item.counterpartyAccountId || item.transactionType === "internal_transfer") && (
                      <div className="mx-3.5 mb-2.5 rounded-lg bg-fill px-3 py-2 text-[11.5px] leading-5 text-ink-muted">
                        {transferHint(item)}
                      </div>
                    )}
                    {item.transactionType !== "internal_transfer" && (
                      <>
                        <div className="h-px bg-separator mr-3.5" />
                        <div className="flex items-center justify-between px-3.5 py-2.5">
                          <label className="text-[13.5px]">وسيلة الدفع</label>
                          <select
                            value={item.paymentMethod}
                            onChange={(e) => updateItem(item.key, { paymentMethod: e.target.value })}
                            className="bg-transparent text-[13.5px] text-ink-muted text-right border-none outline-none"
                          >
                            <option value="">غير محددة</option>
                            {PAYMENT_METHODS.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
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
                    <div className="h-px bg-separator mr-3.5" />
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <label className="text-[13.5px]">الوقت</label>
                      <input
                        type="time"
                        value={item.time ?? ""}
                        onChange={(e) => updateItem(item.key, { time: e.target.value || null })}
                        className="bg-transparent text-[13.5px] text-ink-muted text-right border-none outline-none tabular-nums"
                        dir="ltr"
                      />
                    </div>
                  </fieldset>

                  {!item.saved && !item.duplicate && item.existingTransferId && !item.ignoreExisting && (
                    <div className="px-3.5 py-2.5 border-t border-separator text-[12px] leading-5 text-ink-muted">
                      يبدو إن هذا التحويل مسجّل مسبقًا من رسالة الطرف الثاني.{" "}
                      <Link href={`/transactions/${item.existingTransferId}`} className="font-semibold text-primary">
                        عرض المسجّل
                      </Link>
                      {" · "}
                      <button
                        onClick={() => updateItem(item.key, { ignoreExisting: true })}
                        className="font-semibold text-primary"
                      >
                        سجّلها كعملية جديدة
                      </button>
                    </div>
                  )}
                  {isPending(item) && (
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
