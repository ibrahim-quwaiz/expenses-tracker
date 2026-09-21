"use client";

import Link from "next/link";
import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import { ChevronLeftIcon } from "@/components/icons";

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`w-11 h-[26px] rounded-full relative flex-shrink-0 transition-colors ${on ? "bg-primary" : "bg-fill"}`}
    >
      <span
        className={`absolute top-0.5 w-[22px] h-[22px] rounded-full bg-white shadow transition-all ${
          on ? "right-0.5" : "right-[22px]"
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  return (
    <>
      <div className="flex-shrink-0 px-4 pt-3.5 pb-1.5">
        <div className="text-[22px] font-bold">الإعدادات</div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-2.5 pb-5">
        <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide px-1 pb-1.5 pt-2.5">
          البيانات
        </div>
        <div className="bg-surface rounded-[10px] overflow-hidden mb-5">
          <Link href="/categories" className="flex items-center gap-3 px-3.5 py-3">
            <span className="flex-1 text-[14.5px]">التصنيفات</span>
            <ChevronLeftIcon className="text-[#C7C7CC]" />
          </Link>
          <div className="h-px bg-separator mr-3.5" />
          <Link href="/accounts" className="flex items-center gap-3 px-3.5 py-3">
            <span className="flex-1 text-[14.5px]">الحسابات</span>
            <ChevronLeftIcon className="text-[#C7C7CC]" />
          </Link>
          <div className="h-px bg-separator mr-3.5" />
          <div className="flex items-center gap-3 px-3.5 py-3">
            <span className="flex-1 text-[14.5px] text-ink-faint">الميزانيات الشهرية</span>
            <span className="text-xs text-ink-faint">قريبًا</span>
          </div>
        </div>

        <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide px-1 pb-1.5">التطبيق</div>
        <div className="bg-surface rounded-[10px] overflow-hidden mb-5">
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="flex-1 text-[14.5px]">الوضع الداكن</span>
            <Toggle on={darkMode} onToggle={() => setDarkMode((v) => !v)} />
          </div>
          <div className="h-px bg-separator mr-3.5" />
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="flex-1 text-[14.5px]">إشعارات المصروفات</span>
            <Toggle on={notifications} onToggle={() => setNotifications((v) => !v)} />
          </div>
        </div>

        <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide px-1 pb-1.5">حول</div>
        <div className="bg-surface rounded-[10px] overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-3">
            <span className="text-[14.5px]">الإصدار</span>
            <span className="text-sm text-ink-muted">1.0.0</span>
          </div>
        </div>
      </div>

      <BottomNav />
    </>
  );
}
