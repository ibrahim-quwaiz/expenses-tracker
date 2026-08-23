import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, notFound, serverError, conflict } from "@/lib/http";

function firstOfMonth(dateStr: string): string | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { amount_limit, month_year } = body ?? {};

    if (amount_limit === undefined || Number(amount_limit) < 0) {
      return badRequest("amount_limit must be a non-negative number");
    }
    if (!month_year) return badRequest("month_year is required");

    const normalized = firstOfMonth(month_year);
    if (!normalized) return badRequest("month_year must be a valid date");

    const { rows } = await pool.query(
      `UPDATE budgets SET amount_limit = $1, month_year = $2
       WHERE id = $3
       RETURNING id, category_id, amount_limit, month_year, created_at`,
      [amount_limit, normalized, id],
    );

    if (rows.length === 0) return notFound("Budget not found");
    return ok(rows[0]);
  } catch (error: any) {
    if (error?.code === "23505") {
      return conflict("A budget already exists for this category and month");
    }
    return serverError(error);
  }
}
