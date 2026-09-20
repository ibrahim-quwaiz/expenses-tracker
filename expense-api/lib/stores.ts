import type { Store } from "./types";

const normalize = (s: string) => s.trim().toLowerCase();

/** Finds a store by (case-insensitive) name among existing stores, or creates a new one. */
export async function findOrCreateStore(name: string): Promise<string> {
  const res = await fetch("/api/stores");
  const stores: Store[] = await res.json();
  const match = stores.find((s) => normalize(s.name) === normalize(name));
  if (match) return match.id;

  const created = await fetch("/api/stores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!created.ok) throw new Error("تعذر إنشاء الجهة");
  const store = await created.json();
  return store.id;
}
