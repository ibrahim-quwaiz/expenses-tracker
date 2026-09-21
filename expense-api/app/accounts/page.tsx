"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { formatAmount } from "@/lib/format";
import type { Account } from "@/lib/types";

type EditState = { name: string; account_number: string; balance: string };

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newBalance, setNewBalance] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({ name: "", account_number: "", balance: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function addAccount() {
    if (!newName.trim()) return setAddError("أدخل اسم البنك");
    setSavingNew(true);
    setAddError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          account_number: newNumber.trim() || null,
          balance: newBalance ? parseFloat(newBalance) : 0,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "تعذر إضافة الحساب");
      }
      setNewName("");
      setNewNumber("");
      setNewBalance("");
      setAdding(false);
      load();
    } catch (e: any) {
      setAddError(e.message ?? "حدث خطأ غير متوقع");
    } finally {
      setSavingNew(false);
    }
  }

  function startEdit(acc: Account) {
    setEditingId(acc.id);
    setEdit({ name: acc.name, account_number: acc.account_number ?? "", balance: acc.balance });
    setEditError(null);
  }

  async function saveEdit(id: string) {
    if (!edit.name.trim()) return setEditError("أدخل اسم البنك");
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: edit.name.trim(),
          account_number: edit.account_number.trim() || null,
          balance: parseFloat(edit.balance || "0"),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "تعذر حفظ التعديل");
      }
      setEditingId(null);
      load();
    } catch (e: any) {
      setEditError(e.message ?? "حدث خطأ غير متوقع");
    } finally {
      setSavingEdit(false);
    }
  }

  const totalBalance = accounts.reduce((s, a) => s + parseFloat(a.balance), 0);

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-separator">
        <Link href="/settings" className="flex items-center gap-0.5 text-primary text-[15px]">
          <ChevronRightIcon />
          الإعدادات
        </Link>
        <div className="text-[15px] font-semibold">الحسابات</div>
        <button aria-label="إضافة حساب" onClick={() => setAdding((v) => !v)} className="text-primary">
          <PlusIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-5">
        {!loading && accounts.length > 0 && (
          <div className="px-1 pb-4">
            <div className="text-[13px] text-ink-muted mb-1">إجمالي الأرصدة</div>
            <div className="text-[28px] font-bold tabular-nums tracking-tight">
              {formatAmount(totalBalance)} <span className="text-base font-medium text-ink-muted">ر.س</span>
            </div>
          </div>
        )}

        {adding && (
          <div className="bg-surface rounded-[10px] p-3.5 mb-5 flex flex-col gap-2.5">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اسم البنك"
              className="border border-separator rounded-lg px-3 py-2 text-sm outline-none"
            />
            <input
              type="text"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="رقم الحساب (اختياري)"
              className="border border-separator rounded-lg px-3 py-2 text-sm outline-none"
              dir="ltr"
            />
            <input
              type="number"
              step="0.01"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              placeholder="الرصيد الابتدائي"
              className="border border-separator rounded-lg px-3 py-2 text-sm outline-none text-right"
            />
            {addError && <div className="text-xs text-danger">{addError}</div>}
            <button
              onClick={addAccount}
              disabled={savingNew}
              className="bg-primary text-white text-sm font-semibold rounded-lg py-2 disabled:opacity-50"
            >
              {savingNew ? "..." : "إضافة"}
            </button>
          </div>
        )}

        {loading && <div className="text-sm text-ink-muted text-center py-8">جارٍ التحميل...</div>}
        {!loading && accounts.length === 0 && (
          <div className="text-sm text-ink-muted text-center py-8">لا توجد حسابات بعد</div>
        )}

        <div className="flex flex-col gap-3">
          {accounts.map((acc) =>
            editingId === acc.id ? (
              <div key={acc.id} className="bg-surface rounded-[10px] p-3.5 flex flex-col gap-2.5">
                <input
                  type="text"
                  value={edit.name}
                  onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))}
                  className="border border-separator rounded-lg px-3 py-2 text-sm outline-none"
                />
                <input
                  type="text"
                  value={edit.account_number}
                  onChange={(e) => setEdit((s) => ({ ...s, account_number: e.target.value }))}
                  placeholder="رقم الحساب (اختياري)"
                  className="border border-separator rounded-lg px-3 py-2 text-sm outline-none"
                  dir="ltr"
                />
                <input
                  type="number"
                  step="0.01"
                  value={edit.balance}
                  onChange={(e) => setEdit((s) => ({ ...s, balance: e.target.value }))}
                  className="border border-separator rounded-lg px-3 py-2 text-sm outline-none text-right"
                />
                {editError && <div className="text-xs text-danger">{editError}</div>}
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(acc.id)}
                    disabled={savingEdit}
                    className="flex-1 bg-primary text-white text-sm font-semibold rounded-lg py-2 disabled:opacity-50"
                  >
                    {savingEdit ? "..." : "حفظ"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 bg-fill text-ink text-sm font-semibold rounded-lg py-2"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <button
                key={acc.id}
                onClick={() => startEdit(acc)}
                className="bg-surface rounded-[10px] px-3.5 py-3 flex items-center justify-between text-right"
              >
                <div>
                  <div className="text-[14.5px] font-medium">{acc.name}</div>
                  {acc.account_number && (
                    <div className="text-xs text-ink-muted mt-0.5" dir="ltr">
                      {acc.account_number}
                    </div>
                  )}
                </div>
                <div
                  className={`text-base font-bold tabular-nums ${
                    parseFloat(acc.balance) < 0 ? "text-danger" : "text-success"
                  }`}
                >
                  {formatAmount(acc.balance)} <span className="text-xs font-medium text-ink-muted">ر.س</span>
                </div>
              </button>
            ),
          )}
        </div>
      </div>
    </>
  );
}
