import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, serverError, conflict } from "@/lib/http";
import { applyBalance } from "@/lib/accountBalance";
import { combineDateTime } from "@/lib/dateTime";
import { parseTransactionInput, RETURNING } from "@/lib/transactionInput";

/**
 * Saves an expense the caller extracted (and possibly edited) via POST /api/expenses/parse-sms.
 * Requires raw_sms_hash from that preview call, and re-checks it here to prevent duplicates
 * (including races between two confirms of the same SMS). An internal transfer built from both
 * sides' messages also carries the other message's hash as paired_sms_hash.
 */
export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const input = parseTransactionInput(body);
    if (typeof input === "string") return badRequest(input);

    const { raw_sms_hash, paired_sms_hash } = body ?? {};
    if (!input.store_id && input.transaction_type !== "internal_transfer") return badRequest("store_id is required");
    if (!raw_sms_hash || typeof raw_sms_hash !== "string") {
      return badRequest("raw_sms_hash is required");
    }
    const pairedHash = typeof paired_sms_hash === "string" && paired_sms_hash ? paired_sms_hash : null;
    const hashes = pairedHash ? [raw_sms_hash, pairedHash] : [raw_sms_hash];
    const occurredAt = combineDateTime(input.date, input.time);

    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT id FROM expenses WHERE raw_sms_hash = ANY($1) OR paired_sms_hash = ANY($1)",
      [hashes],
    );
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return conflict("This SMS was already processed");
    }

    const { rows } = await client.query(
      `INSERT INTO expenses (amount, fee, description, date, category_id, store_id, account_id, to_account_id,
                             payment_method, transaction_type, raw_sms_hash, paired_sms_hash, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'sms_paste')
       RETURNING ${RETURNING}`,
      [input.amount, input.fee, input.description, occurredAt, input.category_id, input.store_id, input.account_id, input.to_account_id, input.payment_method, input.transaction_type, raw_sms_hash, pairedHash],
    );

    await applyBalance(client, rows[0], 1);

    await client.query("COMMIT");
    return ok(rows[0], 201);
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error?.code === "23505" && /sms_hash/.test(error?.constraint ?? "")) {
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
