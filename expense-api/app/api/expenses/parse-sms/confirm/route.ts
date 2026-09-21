import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, serverError, conflict } from "@/lib/http";
import { balanceDelta, adjustAccountBalance } from "@/lib/accountBalance";

const VALID_TYPES = ["purchase", "bill_payment", "transfer_out", "transfer_in", "refund"];

/**
 * Saves an expense the caller extracted (and possibly edited) via POST /api/expenses/parse-sms.
 * Requires raw_sms_hash from that preview call, and re-checks it here to prevent duplicates
 * (including races between two confirms of the same SMS).
 */
export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { amount, description, date, category_id, store_id, account_id, payment_method, transaction_type, raw_sms_hash } =
      body ?? {};

    if (amount === undefined || Number(amount) < 0) {
      return badRequest("amount must be a non-negative number");
    }
    if (!date) return badRequest("date is required");
    if (!store_id) return badRequest("store_id is required");
    if (!raw_sms_hash || typeof raw_sms_hash !== "string") {
      return badRequest("raw_sms_hash is required");
    }
    const type = transaction_type ?? "purchase";
    if (!VALID_TYPES.includes(type)) {
      return badRequest(`transaction_type must be one of: ${VALID_TYPES.join(", ")}`);
    }

    await client.query("BEGIN");

    const existing = await client.query("SELECT id FROM expenses WHERE raw_sms_hash = $1", [raw_sms_hash]);
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return conflict("This SMS was already processed");
    }

    const { rows } = await client.query(
      `INSERT INTO expenses (amount, description, date, category_id, store_id, account_id, payment_method, transaction_type, raw_sms_hash, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'sms_paste')
       RETURNING id, amount, description, date, category_id, store_id, account_id, payment_method, transaction_type, source, created_at, updated_at`,
      [amount, description ?? null, date, category_id ?? null, store_id, account_id ?? null, payment_method ?? null, type, raw_sms_hash],
    );

    await adjustAccountBalance(client, account_id, balanceDelta(Number(amount), type));

    await client.query("COMMIT");
    return ok(rows[0], 201);
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error?.code === "23505" && error?.constraint === "idx_expenses_raw_sms_hash") {
      return conflict("This SMS was already processed");
    }
    if (error?.code === "23503") {
      return badRequest("category_id, store_id, or account_id does not reference an existing row");
    }
    return serverError(error);
  } finally {
    client.release();
  }
}
