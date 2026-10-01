import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, serverError } from "@/lib/http";
import { applyBalance } from "@/lib/accountBalance";
import { combineDateTime } from "@/lib/dateTime";
import { parseTransactionInput, RETURNING, SELECT_EXPENSE, VALID_TYPES } from "@/lib/transactionInput";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const category_id = sp.get("category_id");
    const store_id = sp.get("store_id");
    const account_id = sp.get("account_id");
    const from = sp.get("from");
    const to = sp.get("to");
    const transaction_type = sp.get("transaction_type");

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (category_id) {
      params.push(category_id);
      conditions.push(`e.category_id = $${params.length}`);
    }
    if (store_id) {
      params.push(store_id);
      conditions.push(`e.store_id = $${params.length}`);
    }
    if (account_id) {
      params.push(account_id);
      conditions.push(`(e.account_id = $${params.length} OR e.to_account_id = $${params.length})`);
    }
    if (from) {
      params.push(from);
      conditions.push(`e.date >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`e.date < ($${params.length}::date + interval '1 day')`);
    }
    if (transaction_type) {
      if (!VALID_TYPES.includes(transaction_type)) {
        return badRequest(`transaction_type must be one of: ${VALID_TYPES.join(", ")}`);
      }
      params.push(transaction_type);
      conditions.push(`e.transaction_type = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `${SELECT_EXPENSE}
       ${where}
       ORDER BY e.date DESC, e.created_at DESC`,
      params,
    );
    return ok(rows);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const input = parseTransactionInput(await req.json());
    if (typeof input === "string") return badRequest(input);
    const occurredAt = combineDateTime(input.date, input.time);

    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO expenses (amount, fee, description, date, category_id, store_id, account_id, to_account_id, payment_method, transaction_type, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'manual')
       RETURNING ${RETURNING}`,
      [input.amount, input.fee, input.description, occurredAt, input.category_id, input.store_id, input.account_id, input.to_account_id, input.payment_method, input.transaction_type],
    );

    await applyBalance(client, rows[0], 1);

    await client.query("COMMIT");
    return ok(rows[0], 201);
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error?.code === "23503") {
      return badRequest("category_id, store_id, or account_id does not reference an existing row");
    }
    return serverError(error);
  } finally {
    client.release();
  }
}
