import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, serverError } from "@/lib/http";
import { normalizeCardLast4 } from "@/lib/cardLast4";

export async function GET() {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, card_last4, balance, created_at, updated_at FROM accounts ORDER BY name",
    );
    return ok(rows);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, card_last4, balance } = body ?? {};

    if (!name || typeof name !== "string") {
      return badRequest("name is required");
    }
    if (balance !== undefined && Number.isNaN(Number(balance))) {
      return badRequest("balance must be a number");
    }
    const cardLast4 = normalizeCardLast4(card_last4);
    if (cardLast4 === null) {
      return badRequest("card_last4 must be an array of 4-digit strings");
    }

    const { rows } = await pool.query(
      `INSERT INTO accounts (name, card_last4, balance)
       VALUES ($1, $2, $3)
       RETURNING id, name, card_last4, balance, created_at, updated_at`,
      [name, cardLast4, balance ?? 0],
    );
    return ok(rows[0], 201);
  } catch (error) {
    return serverError(error);
  }
}
