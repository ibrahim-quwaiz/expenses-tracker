import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, serverError } from "@/lib/http";

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
      if (!normalized) return badRequest("month must be a valid date, e.g. 2026-08-01");
      params.push(normalized);
      where = "WHERE month_year = $1";
    }

    const { rows } = await pool.query(
      `SELECT budget_id, category_id, category_name, month_year, amount_limit, spent, remaining
       FROM v_budget_status
       ${where}
       ORDER BY month_year DESC, category_name`,
      params,
    );
    return ok(rows);
  } catch (error) {
    return serverError(error);
  }
}
