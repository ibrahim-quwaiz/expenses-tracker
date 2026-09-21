import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, serverError } from "@/lib/http";

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
      conditions.push(`e.date <= $${params.length}`);
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
              e.transaction_type, e.source, e.created_at, e.updated_at
       FROM expenses e
       LEFT JOIN categories c ON c.id = e.category_id
       LEFT JOIN stores s ON s.id = e.store_id
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
  try {
    const body = await req.json();
    const {
      amount,
      description,
      date,
      category_id,
      store_id,
      transaction_type,
    } = body ?? {};

    if (amount === undefined || Number(amount) < 0) {
      return badRequest("amount must be a non-negative number");
    }
    if (!date) return badRequest("date is required");
    const type = transaction_type ?? "purchase";
    if (!VALID_TYPES.includes(type)) {
      return badRequest(`transaction_type must be one of: ${VALID_TYPES.join(", ")}`);
    }

    const { rows } = await pool.query(
      `INSERT INTO expenses (amount, description, date, category_id, store_id, transaction_type, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'manual')
       RETURNING id, amount, description, date, category_id, store_id, transaction_type, source, created_at, updated_at`,
      [amount, description ?? null, date, category_id ?? null, store_id ?? null, type],
    );
    return ok(rows[0], 201);
  } catch (error: any) {
    if (error?.code === "23503") {
      return badRequest("category_id or store_id does not reference an existing row");
    }
    return serverError(error);
  }
}
