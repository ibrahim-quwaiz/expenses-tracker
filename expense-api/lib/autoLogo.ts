import { pool } from "./db";
import { uploadLogo } from "./r2";
import { guessMerchantDomain } from "./claude";

/**
 * Best-effort: guesses a well-known merchant's domain via Claude, fetches its favicon,
 * uploads it to R2, and saves it as the store's logo_url. Never throws — a failure here
 * just leaves the store without a logo (falls back to initials in the UI).
 */
export async function tryAutoFetchLogo(storeId: string, merchantName: string): Promise<string | null> {
  try {
    const domain = await guessMerchantDomain(merchantName);
    if (!domain) return null;

    const faviconRes = await fetch(
      `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`,
    );
    if (!faviconRes.ok) return null;

    const contentType = faviconRes.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/")) return null;

    const buffer = Buffer.from(await faviconRes.arrayBuffer());
    if (buffer.length === 0) return null;

    const ext = contentType.includes("png") ? "png" : contentType.includes("svg") ? "svg" : "ico";
    const logoUrl = await uploadLogo(`logos/${storeId}-auto.${ext}`, buffer, contentType);

    await pool.query("UPDATE stores SET logo_url = $1 WHERE id = $2", [logoUrl, storeId]);
    return logoUrl;
  } catch {
    return null;
  }
}
