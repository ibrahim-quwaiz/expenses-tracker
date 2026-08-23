import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, serverError, conflict } from "@/lib/http";

function firstOfMonth(dateStr: string): string | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function GET(req: NextRequest) {
  try {
    const month = req.nextUrl.searchParams.get("month");
    const params: unknown[] = [];
    let where = "";
    if (month) {
      const normalized = firstOfMonth(month);
      if (!normalized) return badRequest("month must be a valid date");
      params.push(normalized);
      where = "WHERE b.month_year = $1";
    }

    const { rows } = await pool.query(
      `SELECT b.id, b.category_id, c.name AS category_name, b.amount_limit, b.month_year, b.created_at
       FROM budgets b
       JOIN categories c ON c.id = b.category_id
       ${where}
       ORDER BY b.month_year DESC, c.name`,
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
    const { category_id, amount_limit, month_year } = body ?? {};

    if (!category_id) return badRequest("category_id is required");
    if (amount_limit === undefined || Number(amount_limit) < 0) {
      return badRequest("amount_limit must be a non-negative number");
    }
    if (!month_year) return badRequest("month_year is required");

    const normalized = firstOfMonth(month_year);
    if (!normalized) return badRequest("month_year must be a valid date");

    const { rows } = await pool.query(
      `INSERT INTO budgets (category_id, amount_limit, month_year)
       VALUES ($1, $2, $3)
       RETURNING id, category_id, amount_limit, month_year, created_at`,
      [category_id, amount_limit, normalized],
    );
    return ok(rows[0], 201);
  } catch (error: any) {
    if (error?.code === "23505") {
      return conflict("A budget already exists for this category and month");
    }
    if (error?.code === "23503") {
      return badRequest("category_id does not reference an existing category");
    }
    return serverError(error);
  }
}
