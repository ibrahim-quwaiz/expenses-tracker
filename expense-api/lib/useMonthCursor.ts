"use client";

import { useMemo, useState } from "react";

export function useMonthCursor() {
  const [offset, setOffset] = useState(0);

  return useMemo(() => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + offset;
    const first = new Date(Date.UTC(year, month, 1));
    const last = new Date(Date.UTC(year, month + 1, 0));
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      offset,
      setOffset,
      firstOfMonth: `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-01`,
      lastOfMonth: `${last.getUTCFullYear()}-${pad(last.getUTCMonth() + 1)}-${pad(last.getUTCDate())}`,
      date: first,
    };
  }, [offset]);
}
