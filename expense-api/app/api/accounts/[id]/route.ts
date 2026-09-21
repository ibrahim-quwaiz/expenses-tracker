import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, notFound, serverError } from "@/lib/http";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { name, account_number, balance } = body ?? {};

    if (!name || typeof name !== "string") {
      return badRequest("name is required");
    }
    if (balance === undefined || Number.isNaN(Number(balance))) {
      return badRequest("balance must be a number");
    }

    const { rows } = await pool.query(
      `UPDATE accounts SET name = $1, account_number = $2, balance = $3
       WHERE id = $4
       RETURNING id, name, account_number, balance, created_at, updated_at`,
      [name, account_number ?? null, balance, id],
    );

    if (rows.length === 0) return notFound("Account not found");
    return ok(rows[0]);
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { rowCount } = await pool.query("DELETE FROM accounts WHERE id = $1", [id]);
    if (rowCount === 0) return notFound("Account not found");
    return ok({ deleted: true });
  } catch (error) {
    return serverError(error);
  }
}
