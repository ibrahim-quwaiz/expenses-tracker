import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, serverError, conflict } from "@/lib/http";
import { tryAutoFetchLogo } from "@/lib/autoLogo";

const normalize = (s: string) => s.trim().toUpperCase();

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.default_category_id, s.logo_url, s.created_at, s.updated_at,
              COALESCE(
                json_agg(sa.raw_pattern) FILTER (WHERE sa.id IS NOT NULL),
                '[]'
              ) AS aliases
       FROM stores s
       LEFT JOIN store_aliases sa ON sa.store_id = s.id
       GROUP BY s.id
       ORDER BY s.name`,
    );
    return ok(rows);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { name, default_category_id, logo_url, aliases } = body ?? {};

    if (!name || typeof name !== "string") {
      return badRequest("name is required");
    }
    if (aliases !== undefined && !Array.isArray(aliases)) {
      return badRequest("aliases must be an array of strings");
    }

    await client.query("BEGIN");

    const storeResult = await client.query(
      `INSERT INTO stores (name, default_category_id, logo_url)
       VALUES ($1, $2, $3)
       RETURNING id, name, default_category_id, logo_url, created_at, updated_at`,
      [name, default_category_id ?? null, logo_url ?? null],
    );
    const store = storeResult.rows[0];

    const aliasPatterns: string[] = Array.from(
      new Set([name, ...(aliases ?? [])].map((a: string) => normalize(a))),
    );

    for (const pattern of aliasPatterns) {
      await client.query(
        `INSERT INTO store_aliases (raw_pattern, store_id)
         VALUES ($1, $2)
         ON CONFLICT (raw_pattern) DO NOTHING`,
        [pattern, store.id],
      );
    }

    await client.query("COMMIT");

    if (!store.logo_url) {
      const autoLogoUrl = await tryAutoFetchLogo(store.id, name);
      if (autoLogoUrl) store.logo_url = autoLogoUrl;
    }

    return ok({ ...store, aliases: aliasPatterns }, 201);
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") {
      return conflict("One of the given aliases is already linked to another store");
    }
    return serverError(error);
  } finally {
    client.release();
  }
}
