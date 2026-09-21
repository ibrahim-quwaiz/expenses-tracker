import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, notFound, serverError } from "@/lib/http";
import { balanceDelta, adjustAccountBalance } from "@/lib/accountBalance";

const VALID_TYPES = ["purchase", "bill_payment", "transfer_out", "transfer_in", "refund"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.amount, e.description, e.date, e.category_id, c.name AS category_name,
              e.store_id, s.name AS store_name, s.logo_url AS store_logo_url,
              e.account_id, a.name AS account_name, e.payment_method,
              e.transaction_type, e.source, e.created_at, e.updated_at
       FROM expenses e
       LEFT JOIN categories c ON c.id = e.category_id
       LEFT JOIN stores s ON s.id = e.store_id
       LEFT JOIN accounts a ON a.id = e.account_id
       WHERE e.id = $1`,
      [id],
    );
    if (rows.length === 0) return notFound("Expense not found");
    return ok(rows[0]);
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { amount, description, date, category_id, store_id, account_id, payment_method, transaction_type } =
      body ?? {};

    if (amount === undefined || Number(amount) < 0) {
      return badRequest("amount must be a non-negative number");
    }
    if (!date) return badRequest("date is required");
    const type = transaction_type ?? "purchase";
    if (!VALID_TYPES.includes(type)) {
      return badRequest(`transaction_type must be one of: ${VALID_TYPES.join(", ")}`);
    }

    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT amount, transaction_type, account_id FROM expenses WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return notFound("Expense not found");
    }
    const prev = existing.rows[0];

    const { rows } = await client.query(
      `UPDATE expenses
       SET amount = $1, description = $2, date = $3, category_id = $4, store_id = $5,
           account_id = $6, payment_method = $7, transaction_type = $8
       WHERE id = $9
       RETURNING id, amount, description, date, category_id, store_id, account_id, payment_method, transaction_type, source, created_at, updated_at`,
      [amount, description ?? null, date, category_id ?? null, store_id ?? null, account_id ?? null, payment_method ?? null, type, id],
    );

    // reverse the previous effect, then apply the new one
    await adjustAccountBalance(client, prev.account_id, -balanceDelta(Number(prev.amount), prev.transaction_type));
    await adjustAccountBalance(client, account_id, balanceDelta(Number(amount), type));

    await client.query("COMMIT");
    return ok(rows[0]);
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT amount, transaction_type, account_id FROM expenses WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return notFound("Expense not found");
    }
    const prev = existing.rows[0];

    await client.query("DELETE FROM expenses WHERE id = $1", [id]);
    await adjustAccountBalance(client, prev.account_id, -balanceDelta(Number(prev.amount), prev.transaction_type));

    await client.query("COMMIT");
    return ok({ deleted: true });
  } catch (error) {
    await client.query("ROLLBACK");
    return serverError(error);
  } finally {
    client.release();
  }
}
