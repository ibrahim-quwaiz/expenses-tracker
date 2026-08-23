import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, notFound, serverError } from "@/lib/http";

const VALID_TYPES = ["purchase", "bill_payment", "transfer_out", "transfer_in", "refund"];

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { amount, description, date, category_id, store_id, transaction_type } = body ?? {};

    if (amount === undefined || Number(amount) < 0) {
      return badRequest("amount must be a non-negative number");
    }
    if (!date) return badRequest("date is required");
    const type = transaction_type ?? "purchase";
    if (!VALID_TYPES.includes(type)) {
      return badRequest(`transaction_type must be one of: ${VALID_TYPES.join(", ")}`);
    }

    const { rows } = await pool.query(
      `UPDATE expenses
       SET amount = $1, description = $2, date = $3, category_id = $4, store_id = $5, transaction_type = $6
       WHERE id = $7
       RETURNING id, amount, description, date, category_id, store_id, transaction_type, source, created_at, updated_at`,
      [amount, description ?? null, date, category_id ?? null, store_id ?? null, type, id],
    );

    if (rows.length === 0) return notFound("Expense not found");
    return ok(rows[0]);
  } catch (error: any) {
    if (error?.code === "23503") {
      return badRequest("category_id or store_id does not reference an existing row");
    }
    return serverError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { rowCount } = await pool.query("DELETE FROM expenses WHERE id = $1", [id]);
    if (rowCount === 0) return notFound("Expense not found");
    return ok({ deleted: true });
  } catch (error) {
    return serverError(error);
  }
}
