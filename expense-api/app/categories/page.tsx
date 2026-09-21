"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import type { Category } from "@/lib/types";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"expense" | "income">("expense");
  const [saving, setSaving] = useState(false);

  const [subInputs, setSubInputs] = useState<Record<string, string>>({});
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);

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

  async function addSubcategory(parentId: string) {
    const name = (subInputs[parentId] ?? "").trim();
    if (!name) return;
    setAddingSubFor(parentId);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parent_category_id: parentId }),
      });
      if (res.ok) {
        setSubInputs((s) => ({ ...s, [parentId]: "" }));
        load();
      }
    } finally {
      setAddingSubFor(null);
    }
  }

  async function deleteCategory(id: string, isParent: boolean) {
    const msg = isParent ? `حذف هذا التصنيف وكل فئاته الفرعية؟` : "حذف هذه الفئة؟";
    if (!confirm(msg)) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    load();
  }

  const groups = useMemo(() => {
    const topLevel = categories.filter((c) => !c.parent_category_id);
    return topLevel.map((parent) => ({
      parent,
      children: categories.filter((c) => c.parent_category_id === parent.id),
    }));
  }, [categories]);

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-separator">
        <Link href="/settings" className="flex items-center gap-0.5 text-primary text-[15px]">
          <ChevronRightIcon />
          الإعدادات
        </Link>
        <div className="text-[15px] font-semibold">التصنيفات</div>
        <button aria-label="إضافة تصنيف" onClick={() => setAdding((v) => !v)} className="text-primary">
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
              placeholder="اسم التصنيف الرئيسي"
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
        {!loading && groups.length === 0 && (
          <div className="text-sm text-ink-muted text-center py-8">لا توجد تصنيفات بعد</div>
        )}

        <div className="flex flex-col gap-3.5">
          {groups.map(({ parent, children }) => (
            <div key={parent.id} className="bg-surface rounded-[10px] overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-3 bg-fill/40">
                <span className="text-[14.5px] font-semibold">{parent.name}</span>
                <button
                  onClick={() => deleteCategory(parent.id, true)}
                  className="text-xs font-medium text-danger"
                >
                  حذف
                </button>
              </div>

              {children.map((child) => (
                <div key={child.id}>
                  <div className="h-px bg-separator mr-3.5" />
                  <div className="flex items-center justify-between px-3.5 py-2.5 pr-6">
                    <span className="text-[13.5px] text-ink-muted">{child.name}</span>
                    <button
                      onClick={() => deleteCategory(child.id, false)}
                      className="text-xs font-medium text-ink-faint"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}

              <div className="h-px bg-separator mr-3.5" />
              <div className="flex items-center gap-2 px-3.5 py-2.5">
                <input
                  type="text"
                  value={subInputs[parent.id] ?? ""}
                  onChange={(e) => setSubInputs((s) => ({ ...s, [parent.id]: e.target.value }))}
                  placeholder="إضافة فئة فرعية..."
                  className="flex-1 border-none bg-transparent text-[13px] text-ink outline-none"
                />
                <button
                  onClick={() => addSubcategory(parent.id)}
                  disabled={addingSubFor === parent.id}
                  className="text-xs font-semibold text-primary flex-shrink-0 disabled:opacity-50"
                >
                  إضافة
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
