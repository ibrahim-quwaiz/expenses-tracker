import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { extractExpenseFromSms } from "@/lib/claude";
import { ok, badRequest, serverError, conflict } from "@/lib/http";
import { tryAutoFetchLogo } from "@/lib/autoLogo";

const normalize = (s: string) => s.trim().toUpperCase();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sms_text } = body ?? {};

    if (!sms_text || typeof sms_text !== "string" || !sms_text.trim()) {
      return badRequest("sms_text is required");
    }

    const rawSmsHash = createHash("sha256").update(sms_text.trim()).digest("hex");

    const existing = await pool.query(
      `SELECT id, amount, description, date, category_id, store_id, transaction_type, source, created_at
       FROM expenses WHERE raw_sms_hash = $1`,
      [rawSmsHash],
    );
    if (existing.rows.length > 0) {
      return conflict("This SMS was already processed", { expense: existing.rows[0] });
    }

    const extracted = await extractExpenseFromSms(sms_text);
    const pattern = normalize(extracted.merchant);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const aliasMatch = await client.query(
        `SELECT store_id FROM store_aliases WHERE raw_pattern = $1`,
        [pattern],
      );

      let storeId: string;
      let storeCreated = false;
      let categoryId: string | null = null;

      if (aliasMatch.rows.length > 0) {
        storeId = aliasMatch.rows[0].store_id;
        const storeRow = await client.query(
          `SELECT default_category_id FROM stores WHERE id = $1`,
          [storeId],
        );
        categoryId = storeRow.rows[0]?.default_category_id ?? null;
      } else {
        const newStore = await client.query(
          `INSERT INTO stores (name) VALUES ($1) RETURNING id`,
          [extracted.merchant.trim()],
        );
        storeId = newStore.rows[0].id;
        storeCreated = true;

        await client.query(
          `INSERT INTO store_aliases (raw_pattern, store_id) VALUES ($1, $2)
           ON CONFLICT (raw_pattern) DO NOTHING`,
          [pattern, storeId],
        );
      }

      const expenseResult = await client.query(
        `INSERT INTO expenses (amount, description, date, category_id, store_id, transaction_type, raw_sms_hash, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'sms_paste')
         RETURNING id, amount, description, date, category_id, store_id, transaction_type, source, raw_sms_hash, created_at, updated_at`,
        [
          extracted.amount,
          extracted.merchant,
          extracted.date,
          categoryId,
          storeId,
          extracted.transaction_type,
          rawSmsHash,
        ],
      );

      await client.query("COMMIT");

      let logoUrl: string | null = null;
      if (storeCreated) {
        logoUrl = await tryAutoFetchLogo(storeId, extracted.merchant);
      }

      return ok(
        {
          expense: expenseResult.rows[0],
          store_id: storeId,
          store_created: storeCreated,
          store_logo_url: logoUrl,
        },
        201,
      );
    } catch (txError: any) {
      await client.query("ROLLBACK");
      if (txError?.code === "23505" && txError?.constraint === "idx_expenses_raw_sms_hash") {
        return conflict("This SMS was already processed");
      }
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    return serverError(error);
  }
}
