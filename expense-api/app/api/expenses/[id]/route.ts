import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, notFound, serverError } from "@/lib/http";
import { applyBalance } from "@/lib/accountBalance";
import { combineDateTime, timeOfDay } from "@/lib/dateTime";
import { parseTransactionInput, RETURNING, SELECT_EXPENSE } from "@/lib/transactionInput";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { rows } = await pool.query(
      `${SELECT_EXPENSE}
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
    const input = parseTransactionInput(await req.json());
    if (typeof input === "string") return badRequest(input);

    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT amount, fee, transaction_type, account_id, to_account_id, date FROM expenses WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return notFound("Expense not found");
    }
    const prev = existing.rows[0];
    const occurredAt = combineDateTime(input.date, input.time ?? timeOfDay(prev.date));

    const { rows } = await client.query(
      `UPDATE expenses
       SET amount = $1, fee = $2, description = $3, date = $4, category_id = $5, store_id = $6,
           account_id = $7, to_account_id = $8, payment_method = $9, transaction_type = $10
       WHERE id = $11
       RETURNING ${RETURNING}`,
      [input.amount, input.fee, input.description, occurredAt, input.category_id, input.store_id, input.account_id, input.to_account_id, input.payment_method, input.transaction_type, id],
    );

    // reverse the previous effect, then apply the new one
    await applyBalance(client, prev, -1);
    await applyBalance(client, rows[0], 1);

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
      "SELECT amount, fee, transaction_type, account_id, to_account_id FROM expenses WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return notFound("Expense not found");
    }
    const prev = existing.rows[0];

    await client.query("DELETE FROM expenses WHERE id = $1", [id]);
    await applyBalance(client, prev, -1);

    await client.query("COMMIT");
    return ok({ deleted: true });
  } catch (error) {
    await client.query("ROLLBACK");
    return serverError(error);
  } finally {
    client.release();
  }
}
