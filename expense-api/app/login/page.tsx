"use client";

import { useState } from "react";

function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.replace(safeNext());
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(
        body.error === "not_configured"
          ? "لم يتم ضبط كلمة المرور على الخادم بعد (APP_PASSWORD)"
          : "كلمة المرور غير صحيحة",
      );
      setPassword("");
    } catch {
      setError("تعذر الاتصال، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-center px-6 pb-24">
      <div className="text-center mb-8">
        <img src="/icon-192.png" alt="" width={64} height={64} className="mx-auto rounded-[14px] mb-4" />
        <div className="text-[22px] font-bold">مصروفاتي</div>
        <div className="text-sm text-ink-muted mt-1">أدخل كلمة المرور للمتابعة</div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="كلمة المرور"
          aria-label="كلمة المرور"
          className="bg-surface border border-separator rounded-[10px] px-4 py-3 text-[15px] outline-none focus:border-primary"
        />
        {error && <div className="text-sm text-danger text-center">{error}</div>}
        <button
          type="submit"
          disabled={submitting || !password}
          className="bg-primary text-white text-[15px] font-semibold rounded-[10px] py-3 disabled:opacity-50"
        >
          {submitting ? "..." : "دخول"}
        </button>
      </form>
    </div>
  );
}
