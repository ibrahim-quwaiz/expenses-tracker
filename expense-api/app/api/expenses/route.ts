import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, serverError } from "@/lib/http";
import { balanceDelta, adjustAccountBalance } from "@/lib/accountBalance";
import { combineDateTime } from "@/lib/dateTime";

const VALID_TYPES = ["purchase", "bill_payment", "transfer_out", "transfer_in", "refund"];

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const category_id = sp.get("category_id");
    const store_id = sp.get("store_id");
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
      `SELECT e.id, e.amount, e.description, e.date, e.category_id, c.name AS category_name,
              e.store_id, s.name AS store_name, s.logo_url AS store_logo_url,
              e.account_id, a.name AS account_name, e.payment_method,
              e.transaction_type, e.source, e.created_at, e.updated_at
       FROM expenses e
       LEFT JOIN categories c ON c.id = e.category_id
       LEFT JOIN stores s ON s.id = e.store_id
       LEFT JOIN accounts a ON a.id = e.account_id
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
    const body = await req.json();
    const {
      amount,
      description,
      date,
      time,
      category_id,
      store_id,
      account_id,
      payment_method,
      transaction_type,
    } = body ?? {};

    if (amount === undefined || Number(amount) < 0) {
      return badRequest("amount must be a non-negative number");
    }
    if (!date) return badRequest("date is required");
    if (!account_id) return badRequest("account_id is required");
    const type = transaction_type ?? "purchase";
    if (!VALID_TYPES.includes(type)) {
      return badRequest(`transaction_type must be one of: ${VALID_TYPES.join(", ")}`);
    }
    const occurredAt = combineDateTime(date, time);

    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO expenses (amount, description, date, category_id, store_id, account_id, payment_method, transaction_type, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'manual')
       RETURNING id, amount, description, date, category_id, store_id, account_id, payment_method, transaction_type, source, created_at, updated_at`,
      [amount, description ?? null, occurredAt, category_id ?? null, store_id ?? null, account_id ?? null, payment_method ?? null, type],
    );

    await adjustAccountBalance(client, account_id, balanceDelta(Number(amount), type));

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
