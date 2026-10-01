"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "@/components/BottomNav";
import TransactionAvatar from "@/components/TransactionAvatar";
import { PlusIcon, ChevronRightIcon, ChevronLeftIcon } from "@/components/icons";
import { useMonthCursor } from "@/lib/useMonthCursor";
import { balanceDelta } from "@/lib/accountBalance";
import { formatAmount, formatMonthYear, relativeDayLabel, formatTime } from "@/lib/format";
import type { Account, Expense } from "@/lib/types";
import { TRANSACTION_TYPE_LABELS, transactionTitle } from "@/lib/types";

type EditState = { name: string; card_last4: string[]; balance: string };

const ALL = "all";
const SELECTED_KEY = "accounts:selected";
const LAST4_RE = /^\d{4}$/;

function CardLast4Editor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function addCard() {
    const v = draft.trim();
    if (!v) return;
    if (!LAST4_RE.test(v)) return setErr("أدخل آخر 4 أرقام من البطاقة فقط");
    if (value.includes(v)) return setErr("هذا الرقم مضاف مسبقًا");
    onChange([...value, v]);
    setDraft("");
    setErr(null);
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((v) => (
            <span
              key={v}
              className="flex items-center gap-1 bg-fill rounded-full pl-1 pr-2.5 py-1 text-xs tabular-nums"
              dir="ltr"
            >
              •••• {v}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                aria-label="حذف البطاقة"
                className="w-4 h-4 rounded-full bg-ink-faint/20 text-ink-muted text-[10px] leading-4 text-center"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value.replace(/\D/g, ""));
            setErr(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCard();
            }
          }}
          placeholder="آخر 4 أرقام من البطاقة"
          className="flex-1 border border-separator rounded-lg px-3 py-2 text-sm outline-none"
          dir="ltr"
        />
        <button type="button" onClick={addCard} className="px-3 rounded-lg bg-fill text-sm font-semibold text-ink">
          إضافة
        </button>
      </div>
      {err && <div className="text-xs text-danger mt-1">{err}</div>}
    </div>
  );
}

function AccountTile({
  title,
  amount,
  sub,
  active,
  onClick,
}: {
  title: string;
  amount: number;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex-shrink-0 w-[140px] snap-start rounded-[12px] bg-surface px-3 py-2.5 text-right border-2 ${
        active ? "border-primary" : "border-transparent"
      }`}
    >
      <div className={`text-[13px] truncate ${active ? "text-primary font-semibold" : "text-ink-muted"}`}>{title}</div>
      <div className={`text-[17px] font-bold tabular-nums mt-0.5 ${amount < 0 ? "text-danger" : "text-ink"}`}>
        {formatAmount(amount)} <span className="text-[11px] font-medium text-ink-muted">ر.س</span>
      </div>
      <div className="text-[11px] text-ink-faint mt-0.5 truncate tabular-nums">{sub}</div>
    </button>
  );
}

export default function AccountsPage() {
  const month = useMonthCursor();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [selected, setSelected] = useState<string>(ALL);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCards, setNewCards] = useState<string[]>([]);
  const [newBalance, setNewBalance] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<EditState>({ name: "", card_last4: [], balance: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function loadAccounts() {
    setAccountsLoading(true);
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .finally(() => setAccountsLoading(false));
  }

  useEffect(() => {
    loadAccounts();
    try {
      const saved = sessionStorage.getItem(SELECTED_KEY);
      if (saved) setSelected(saved);
    } catch {}
  }, []);

  const selectedAccount = accounts.find((a) => a.id === selected) ?? null;

  useEffect(() => {
    if (!accountsLoading && selected !== ALL && !selectedAccount) setSelected(ALL);
  }, [accountsLoading, selected, selectedAccount]);

  useEffect(() => {
    let cancelled = false;
    setExpensesLoading(true);
    const params = new URLSearchParams({ from: month.firstOfMonth, to: month.lastOfMonth });
    if (selected !== ALL) params.set("account_id", selected);
    fetch(`/api/expenses?${params}`)
      .then((r) => r.json())
      .then((data) => !cancelled && setExpenses(Array.isArray(data) ? data : []))
      .finally(() => !cancelled && setExpensesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected, month.firstOfMonth, month.lastOfMonth]);

  function select(id: string) {
    setSelected(id);
    setEditing(false);
    try {
      sessionStorage.setItem(SELECTED_KEY, id);
    } catch {}
  }

  const { inflow, outflow } = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const e of expenses) {
      const d = balanceDelta(e, selected === ALL ? null : selected);
      if (d > 0) inflow += d;
      else outflow -= d;
    }
    return { inflow, outflow };
  }, [expenses, selected]);

  const groups = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of expenses) {
      const label = relativeDayLabel(e.date);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(e);
    }
    return Array.from(map.entries());
  }, [expenses]);

  const totalBalance = accounts.reduce((s, a) => s + parseFloat(a.balance), 0);

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
          card_last4: newCards,
          balance: newBalance ? parseFloat(newBalance) : 0,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "تعذر إضافة الحساب");
      }
      setNewName("");
      setNewCards([]);
      setNewBalance("");
      setAdding(false);
      loadAccounts();
    } catch (e: any) {
      setAddError(e.message ?? "حدث خطأ غير متوقع");
    } finally {
      setSavingNew(false);
    }
  }

  function startEdit(acc: Account) {
    setEdit({ name: acc.name, card_last4: acc.card_last4 ?? [], balance: acc.balance });
    setEditError(null);
    setEditing(true);
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
          card_last4: edit.card_last4,
          balance: parseFloat(edit.balance || "0"),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "تعذر حفظ التعديل");
      }
      setEditing(false);
      loadAccounts();
    } catch (e: any) {
      setEditError(e.message ?? "حدث خطأ غير متوقع");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-3.5 pb-1.5">
        <div className="text-[22px] font-bold">الحسابات</div>
        <button
          aria-label="إضافة حساب"
          onClick={() => setAdding((v) => !v)}
          className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center"
        >
          <PlusIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {adding && (
          <div className="mx-4 mt-2 bg-surface rounded-[10px] p-3.5 flex flex-col gap-2.5">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اسم البنك"
              className="border border-separator rounded-lg px-3 py-2 text-sm outline-none"
            />
            <CardLast4Editor value={newCards} onChange={setNewCards} />
            <input
              type="number"
              step="0.01"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              placeholder="الرصيد الابتدائي"
              className="border border-separator rounded-lg px-3 py-2 text-sm outline-none text-right"
            />
            {addError && <div className="text-xs text-danger">{addError}</div>}
            <div className="flex gap-2">
              <button
                onClick={addAccount}
                disabled={savingNew}
                className="flex-1 bg-primary text-white text-sm font-semibold rounded-lg py-2 disabled:opacity-50"
              >
                {savingNew ? "..." : "إضافة"}
              </button>
              <button
                onClick={() => setAdding(false)}
                className="flex-1 bg-fill text-ink text-sm font-semibold rounded-lg py-2"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {accountsLoading && accounts.length === 0 && (
          <div className="text-sm text-ink-muted text-center py-8">جارٍ التحميل...</div>
        )}
        {!accountsLoading && accounts.length === 0 && !adding && (
          <div className="text-sm text-ink-muted text-center py-8">لا توجد حسابات بعد — اضغط + لإضافة حساب</div>
        )}

        {accounts.length > 0 && (
          <>
            <div className="flex gap-2.5 overflow-x-auto snap-x px-4 pt-2 pb-1">
              <AccountTile
                title="الكل"
                amount={totalBalance}
                sub="كل الحسابات"
                active={selected === ALL}
                onClick={() => select(ALL)}
              />
              {accounts.map((a) => (
                <AccountTile
                  key={a.id}
                  title={a.name}
                  amount={parseFloat(a.balance)}
                  sub={a.card_last4?.length ? a.card_last4.join(" · ") : "بدون بطاقات"}
                  active={selected === a.id}
                  onClick={() => select(a.id)}
                />
              ))}
            </div>

            {selectedAccount && !editing && (
              <div className="px-4 pt-1.5 flex justify-end">
                <button onClick={() => startEdit(selectedAccount)} className="text-[13px] font-medium text-primary">
                  تعديل الحساب
                </button>
              </div>
            )}

            {selectedAccount && editing && (
              <div className="mx-4 mt-2.5 bg-surface rounded-[10px] p-3.5 flex flex-col gap-2.5">
                <input
                  type="text"
                  value={edit.name}
                  onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))}
                  placeholder="اسم البنك"
                  className="border border-separator rounded-lg px-3 py-2 text-sm outline-none"
                />
                <CardLast4Editor
                  value={edit.card_last4}
                  onChange={(next) => setEdit((s) => ({ ...s, card_last4: next }))}
                />
                <label className="text-xs text-ink-muted -mb-1.5">الرصيد</label>
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
                    onClick={() => saveEdit(selectedAccount.id)}
                    disabled={savingEdit}
                    className="flex-1 bg-primary text-white text-sm font-semibold rounded-lg py-2 disabled:opacity-50"
                  >
                    {savingEdit ? "..." : "حفظ"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 bg-fill text-ink text-sm font-semibold rounded-lg py-2"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-4 pt-4 pb-1">
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
              <div className="flex items-center gap-3 text-[12.5px] text-ink-muted">
                <span>
                  داخل{" "}
                  <b className="font-semibold text-success tabular-nums" dir="ltr">
                    +{formatAmount(inflow)}
                  </b>
                </span>
                <span>
                  خارج{" "}
                  <b className="font-semibold text-ink tabular-nums" dir="ltr">
                    −{formatAmount(outflow)}
                  </b>
                </span>
              </div>
            </div>

            <div className="px-4 pt-1 pb-5">
              {expensesLoading && <div className="text-sm text-ink-muted text-center py-8">جارٍ التحميل...</div>}
              {!expensesLoading && groups.length === 0 && (
                <div className="text-sm text-ink-muted text-center py-8">لا توجد حركات في هذا الشهر</div>
              )}
              {!expensesLoading &&
                groups.map(([label, items]) => (
                  <div key={label}>
                    <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide px-1 pt-2.5 pb-1.5">
                      {label}
                    </div>
                    <div className="bg-surface rounded-[10px] overflow-hidden mb-4.5">
                      {items.map((e, i) => {
                        // Across all accounts a transfer between them only moves money; show it unsigned.
                        const neutral = selected === ALL && e.transaction_type === "internal_transfer";
                        const delta = neutral ? 0 : balanceDelta(e, selected === ALL ? null : selected);
                        return (
                          <div key={e.id}>
                            <Link href={`/transactions/${e.id}`} className="flex items-center gap-3 px-3.5 py-2.5">
                              <TransactionAvatar expense={e} />
                              <div className="flex-1 min-w-0">
                                <div className="text-[14.5px] font-medium truncate">{transactionTitle(e)}</div>
                                <div className="text-xs text-ink-muted mt-0.5 truncate">
                                  {TRANSACTION_TYPE_LABELS[e.transaction_type]} &middot;{" "}
                                  {selected === ALL && !neutral && <>{e.account_name ?? "بدون حساب"} &middot; </>}
                                  {formatTime(e.date)}
                                </div>
                                {e.description && (
                                  <div className="text-xs text-ink-faint mt-0.5 truncate">{e.description}</div>
                                )}
                              </div>
                              <div
                                className={`text-[14.5px] tabular-nums flex-shrink-0 ${
                                  delta > 0 ? "text-success font-medium" : ""
                                }`}
                              >
                                <span dir="ltr">
                                  {neutral ? "" : delta > 0 ? "+" : "−"}
                                  {formatAmount(neutral ? e.amount : Math.abs(delta))}
                                </span>{" "}
                                <span className="text-xs text-ink-muted">ر.س</span>
                              </div>
                            </Link>
                            {i < items.length - 1 && <div className="h-px bg-separator mr-[60px]" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </>
  );
}
