"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, ListIcon, ChartIcon, GearIcon } from "./icons";

const tabs = [
  { href: "/", label: "الرئيسية", Icon: HomeIcon },
  { href: "/transactions", label: "الحركات", Icon: ListIcon },
  { href: "/reports", label: "التقارير", Icon: ChartIcon },
  { href: "/settings", label: "الإعدادات", Icon: GearIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="flex-shrink-0 flex border-t border-separator bg-bg/95 pb-0.5">
      {tabs.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 pb-1 text-[10px] font-medium ${
              active ? "text-primary" : "text-ink-faint"
            }`}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
