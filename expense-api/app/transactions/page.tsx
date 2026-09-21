"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "@/components/BottomNav";
import StoreAvatar from "@/components/StoreAvatar";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { formatAmount, relativeDayLabel, formatTime } from "@/lib/format";
import type { Category, Expense } from "@/lib/types";
import { TRANSACTION_TYPE_LABELS } from "@/lib/types";

export default function TransactionsPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/expenses").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ])
      .then(([exp, cats]) => {
        setExpenses(Array.isArray(exp) ? exp : []);
        setCategories(Array.isArray(cats) ? cats : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (activeCategory && e.category_id !== activeCategory) return false;
      if (!q) return true;
      return (
        (e.store_name ?? "").toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q) ||
        (e.category_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [expenses, search, activeCategory]);

  const groups = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of filtered) {
      const label = relativeDayLabel(e.date);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(e);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-3.5 pb-1.5">
        <div className="text-[22px] font-bold">الحركات</div>
        <Link
          href="/add"
          aria-label="إضافة مصروف"
          className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center"
        >
          <PlusIcon />
        </Link>
      </div>

      <div className="flex-shrink-0 px-4 pt-2 pb-2.5">
        <div className="relative flex items-center">
          <SearchIcon className="absolute right-[11px] text-ink-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث"
            className="w-full bg-fill border-none rounded-[9px] py-2 pr-[34px] pl-3 text-sm text-ink outline-none"
          />
        </div>
      </div>

      <div className="flex-shrink-0 flex gap-2 px-4 pb-2.5 overflow-x-auto">
        <button
          onClick={() => setActiveCategory(null)}
          className={`flex-shrink-0 text-[12.5px] font-semibold py-1.5 px-3.5 rounded-lg ${
            activeCategory === null ? "bg-ink text-white" : "bg-fill text-ink font-medium"
          }`}
        >
          الكل
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`flex-shrink-0 text-[12.5px] font-semibold py-1.5 px-3.5 rounded-lg whitespace-nowrap ${
              activeCategory === c.id ? "bg-ink text-white" : "bg-fill text-ink font-medium"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-1 pb-5">
        {loading && <div className="text-sm text-ink-muted text-center py-8">جارٍ التحميل...</div>}
        {!loading && groups.length === 0 && (
          <div className="text-sm text-ink-muted text-center py-8">لا توجد نتائج</div>
        )}
        {groups.map(([label, items]) => (
          <div key={label}>
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide px-1 pt-2.5 pb-1.5">
              {label}
            </div>
            <div className="bg-surface rounded-[10px] overflow-hidden mb-4.5">
              {items.map((e, i) => (
                <div key={e.id}>
                  <Link href={`/transactions/${e.id}`} className="flex items-center gap-3 px-3.5 py-2.5">
                    <StoreAvatar name={e.store_name} logoUrl={e.store_logo_url} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14.5px] font-medium truncate">{e.store_name ?? "بدون جهة"}</div>
                      <div className="text-xs text-ink-muted mt-0.5 truncate">
                        {e.category_name ?? "بدون تصنيف"} &middot; {TRANSACTION_TYPE_LABELS[e.transaction_type]} &middot;{" "}
                        {formatTime(e.created_at)}
                      </div>
                    </div>
                    <div className="text-[14.5px] tabular-nums flex-shrink-0">{formatAmount(e.amount)} ر.س</div>
                  </Link>
                  {i < items.length - 1 && <div className="h-px bg-separator mr-[60px]" />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </>
  );
}
