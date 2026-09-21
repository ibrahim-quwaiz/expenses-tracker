import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, serverError } from "@/lib/http";

export async function GET() {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, account_number, balance, created_at, updated_at FROM accounts ORDER BY name",
    );
    return ok(rows);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, account_number, balance } = body ?? {};

    if (!name || typeof name !== "string") {
      return badRequest("name is required");
    }
    if (balance !== undefined && Number.isNaN(Number(balance))) {
      return badRequest("balance must be a number");
    }

    const { rows } = await pool.query(
      `INSERT INTO accounts (name, account_number, balance)
       VALUES ($1, $2, $3)
       RETURNING id, name, account_number, balance, created_at, updated_at`,
      [name, account_number ?? null, balance ?? 0],
    );
    return ok(rows[0], 201);
  } catch (error) {
    return serverError(error);
  }
}
