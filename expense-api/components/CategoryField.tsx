"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import type { Category } from "@/lib/types";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-full text-[13px] border ${
        active ? "bg-primary text-white border-primary font-semibold" : "bg-fill text-ink border-transparent"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Category row with one-tap suggestions (the categories most recently used with this merchant)
 * and a two-step picker: main category, then subcategory.
 * With `autoFill`, the top suggestion is applied until the user picks a category themselves.
 */
export default function CategoryField({
  categories,
  value,
  onChange,
  merchant,
  autoFill = false,
  compact = false,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  merchant: string;
  autoFill?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeParent, setActiveParent] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const autoValue = useRef<string>(autoFill ? value : "");
  const userPicked = useRef(false);
  const latest = useRef({ value, onChange });
  useEffect(() => {
    latest.current = { value, onChange };
  });

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const parents = useMemo(() => categories.filter((c) => !c.parent_category_id), [categories]);

  useEffect(() => {
    const name = merchant.trim();
    if (!name) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/category-suggestions?merchant=${encodeURIComponent(name)}`)
        .then((r) => (r.ok ? r.json() : { category_ids: [] }))
        .then((data) => {
          if (cancelled) return;
          const ids: string[] = (data.category_ids ?? []).filter((id: string) => byId.has(id));
          setSuggestions(ids);
          const { value: current, onChange: apply } = latest.current;
          const untouched = !userPicked.current && (current === "" || current === autoValue.current);
          if (autoFill && ids[0] && untouched && ids[0] !== current) {
            autoValue.current = ids[0];
            apply(ids[0]);
          }
        })
        .catch(() => {});
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [merchant, byId, autoFill]);

  function label(id: string): string {
    const c = byId.get(id);
    if (!c) return "";
    const parent = c.parent_category_id ? byId.get(c.parent_category_id) : null;
    return parent ? `${parent.name} ← ${c.name}` : c.name;
  }

  function pick(id: string) {
    userPicked.current = true;
    onChange(id);
    setOpen(false);
  }

  function toggle() {
    if (!open) {
      const current = byId.get(value);
      setActiveParent(current ? current.parent_category_id ?? current.id : null);
    }
    setOpen((o) => !o);
  }

  const children = activeParent ? categories.filter((c) => c.parent_category_id === activeParent) : [];
  const text = compact ? "text-[13.5px]" : "text-[14.5px]";

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-3 px-3.5 ${compact ? "py-2.5" : "py-3"}`}
      >
        <span className={text}>التصنيف</span>
        <span className={`flex items-center gap-1.5 ${text} ${value ? "text-ink-muted" : "text-ink-faint"} min-w-0`}>
          <span className="truncate">{value ? label(value) : "اختر التصنيف"}</span>
          <ChevronLeftIcon className={`flex-shrink-0 transition-transform ${open ? "-rotate-90" : ""}`} />
        </span>
      </button>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3.5 pb-2.5">
          <span className="text-[11.5px] text-ink-faint ml-0.5">مقترح:</span>
          {suggestions.map((id) => (
            <Chip key={id} active={id === value} onClick={() => pick(id)}>
              {byId.get(id)?.name}
            </Chip>
          ))}
        </div>
      )}

      {open && (
        <div className="px-3.5 pt-2.5 pb-3 border-t border-separator">
          <div className="flex flex-wrap gap-1.5">
            {parents.map((p) => (
              <Chip key={p.id} active={p.id === activeParent} onClick={() => setActiveParent(p.id)}>
                {p.name}
              </Chip>
            ))}
          </div>
          {activeParent && (
            <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-dashed border-separator">
              <Chip active={value === activeParent} onClick={() => pick(activeParent)}>
                {byId.get(activeParent)?.name} (عام)
              </Chip>
              {children.map((c) => (
                <Chip key={c.id} active={value === c.id} onClick={() => pick(c.id)}>
                  {c.name}
                </Chip>
              ))}
            </div>
          )}
          {!activeParent && <div className="text-xs text-ink-faint mt-2">اختر التصنيف الرئيسي</div>}
        </div>
      )}
    </div>
  );
}
