import { pool } from "./db";

/** Stores whose name or alias matches a merchant name as typed or extracted from an SMS. */
export async function storeIdsForMerchant(merchant: string): Promise<string[]> {
  const name = merchant.trim();
  if (!name) return [];
  const { rows } = await pool.query(
    `SELECT id FROM stores WHERE lower(trim(name)) = lower($1)
     UNION
     SELECT store_id FROM store_aliases WHERE raw_pattern = upper($1)`,
    [name],
  );
  return rows.map((r) => r.id);
}

/** Up to 3 categories used with these stores, most recently used first. */
export async function categorySuggestionsForStores(storeIds: string[]): Promise<string[]> {
  if (storeIds.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT category_id FROM (
       SELECT category_id, max(date) AS last_used
       FROM expenses
       WHERE store_id = ANY($1::uuid[]) AND category_id IS NOT NULL
       GROUP BY category_id
     ) t
     ORDER BY last_used DESC
     LIMIT 3`,
    [storeIds],
  );
  if (rows.length > 0) return rows.map((r) => r.category_id);

  const fallback = await pool.query(
    `SELECT default_category_id FROM stores
     WHERE id = ANY($1::uuid[]) AND default_category_id IS NOT NULL
     LIMIT 1`,
    [storeIds],
  );
  return fallback.rows.map((r) => r.default_category_id);
}
