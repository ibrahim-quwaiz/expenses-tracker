import { pool } from "./db";
import { uploadLogo } from "./r2";
import { identifyMerchantBrand } from "./claude";

const WIKIMEDIA_USER_AGENT = "ExpenseTrackerApp/1.0 (personal finance app; logo lookup)";
const MAX_LOGO_BYTES = 3 * 1024 * 1024;

type FetchedImage = { buffer: Buffer; contentType: string };

function extFromContentType(contentType: string): string {
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

/** Searches Wikimedia Commons for an official-looking brand logo file and downloads it. */
async function fetchWikimediaLogo(englishName: string): Promise<FetchedImage | null> {
  const searchUrl =
    "https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&format=json&srlimit=5" +
    `&srsearch=${encodeURIComponent(`${englishName} logo`)}`;

  const searchRes = await fetch(searchUrl, { headers: { "User-Agent": WIKIMEDIA_USER_AGENT } });
  if (!searchRes.ok) return null;

  const data = await searchRes.json();
  const results: { title: string }[] = data?.query?.search ?? [];
  const candidate = results.find((r) => /\.(svg|png)$/i.test(r.title)) ?? results[0];
  if (!candidate) return null;

  const fileName = candidate.title.replace(/^File:/, "");
  const fileUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
  const fileRes = await fetch(fileUrl, { headers: { "User-Agent": WIKIMEDIA_USER_AGENT } });
  if (!fileRes.ok) return null;

  const contentType = fileRes.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) return null;

  const buffer = Buffer.from(await fileRes.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_LOGO_BYTES) return null;

  return { buffer, contentType };
}

/** Fallback: fetches a domain's favicon via Google's favicon service. Lower quality but broader coverage. */
async function fetchFavicon(domain: string): Promise<FetchedImage | null> {
  const res = await fetch(`https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`);
  if (!res.ok) return null;

  const contentType = res.headers.get("content-type") ?? "image/png";
  if (!contentType.startsWith("image/")) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) return null;

  return { buffer, contentType };
}

/**
 * Best-effort: asks Claude whether the merchant is a well-known brand, then tries to fetch its
 * real logo from Wikimedia Commons (higher quality) and falls back to a favicon. Uploads whatever
 * it finds to R2 and saves it as the store's logo_url. Never throws — a failure here just leaves
 * the store without a logo (falls back to initials in the UI).
 */
export async function tryAutoFetchLogo(storeId: string, merchantName: string): Promise<string | null> {
  try {
    const brand = await identifyMerchantBrand(merchantName);
    if (!brand.domain && !brand.english_name) return null;

    let image: FetchedImage | null = null;
    if (brand.english_name) {
      image = await fetchWikimediaLogo(brand.english_name).catch(() => null);
    }
    if (!image && brand.domain) {
      image = await fetchFavicon(brand.domain).catch(() => null);
    }
    if (!image) return null;

    const ext = extFromContentType(image.contentType);
    const logoUrl = await uploadLogo(`logos/${storeId}-auto.${ext}`, image.buffer, image.contentType);

    await pool.query("UPDATE stores SET logo_url = $1 WHERE id = $2", [logoUrl, storeId]);
    return logoUrl;
  } catch {
    return null;
  }
}
