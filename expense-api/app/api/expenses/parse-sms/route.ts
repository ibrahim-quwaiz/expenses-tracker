import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { extractExpenseFromSms } from "@/lib/claude";
import { ok, badRequest, serverError, conflict } from "@/lib/http";

const normalize = (s: string) => s.trim().toUpperCase();

/**
 * Preview-only: extracts structured data from the SMS text via Claude and looks up a
 * matching store, but does NOT write anything to the database. The caller reviews/edits
 * the result and saves it via POST /api/expenses/parse-sms/confirm.
 */
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

    const aliasMatch = await pool.query(
      `SELECT s.id, s.default_category_id
       FROM store_aliases sa JOIN stores s ON s.id = sa.store_id
       WHERE sa.raw_pattern = $1`,
      [pattern],
    );
    const matchedStore = aliasMatch.rows[0] ?? null;

    return ok({
      extracted,
      raw_sms_hash: rawSmsHash,
      matched_store_id: matchedStore?.id ?? null,
      matched_category_id: matchedStore?.default_category_id ?? null,
    });
  } catch (error) {
    return serverError(error);
  }
}
