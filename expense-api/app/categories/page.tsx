"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRightIcon, ChevronLeftIcon, PlusIcon } from "@/components/icons";
import type { Category } from "@/lib/types";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"expense" | "income">("expense");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((cats) => setCategories(Array.isArray(cats) ? cats : []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function addCategory() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), type: newType }),
      });
      if (res.ok) {
        setNewName("");
        setAdding(false);
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  const expenseCats = categories.filter((c) => c.type !== "income");
  const incomeCats = categories.filter((c) => c.type === "income");

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-separator">
        <Link href="/settings" className="flex items-center gap-0.5 text-primary text-[15px]">
          <ChevronRightIcon />
          الإعدادات
        </Link>
        <div className="text-[15px] font-semibold">التصنيفات</div>
        <button
          aria-label="إضافة تصنيف"
          onClick={() => setAdding((v) => !v)}
          className="text-primary"
        >
          <PlusIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-5">
        {adding && (
          <div className="bg-surface rounded-[10px] p-3.5 mb-5 flex flex-col gap-2.5">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اسم التصنيف"
              className="border border-separator rounded-lg px-3 py-2 text-sm outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setNewType("expense")}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-lg ${
                  newType === "expense" ? "bg-ink text-white" : "bg-fill text-ink-muted"
                }`}
              >
                مصروف
              </button>
              <button
                onClick={() => setNewType("income")}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-lg ${
                  newType === "income" ? "bg-ink text-white" : "bg-fill text-ink-muted"
                }`}
              >
                دخل
              </button>
            </div>
            <button
              onClick={addCategory}
              disabled={saving}
              className="bg-primary text-white text-sm font-semibold rounded-lg py-2 disabled:opacity-50"
            >
              {saving ? "..." : "إضافة"}
            </button>
          </div>
        )}

        {loading && <div className="text-sm text-ink-muted text-center py-8">جارٍ التحميل...</div>}

        {!loading && (
          <>
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide px-1 pb-1.5">مصروفات</div>
            <div className="bg-surface rounded-[10px] overflow-hidden mb-5">
              {expenseCats.length === 0 && (
                <div className="px-3.5 py-3 text-sm text-ink-faint">لا توجد تصنيفات</div>
              )}
              {expenseCats.map((c, i) => (
                <div key={c.id}>
                  <div className="flex items-center gap-3 px-3.5 py-3">
                    <span className="flex-1 text-[14.5px]">{c.name}</span>
                    <ChevronLeftIcon className="text-[#C7C7CC]" />
                  </div>
                  {i < expenseCats.length - 1 && <div className="h-px bg-separator mr-3.5" />}
                </div>
              ))}
            </div>

            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide px-1 pb-1.5">دخل</div>
            <div className="bg-surface rounded-[10px] overflow-hidden">
              {incomeCats.length === 0 && (
                <div className="px-3.5 py-3 text-sm text-ink-faint">لا توجد تصنيفات</div>
              )}
              {incomeCats.map((c, i) => (
                <div key={c.id}>
                  <div className="flex items-center gap-3 px-3.5 py-3">
                    <span className="flex-1 text-[14.5px]">{c.name}</span>
                    <ChevronLeftIcon className="text-[#C7C7CC]" />
                  </div>
                  {i < incomeCats.length - 1 && <div className="h-px bg-separator mr-3.5" />}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
