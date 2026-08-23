import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, serverError, conflict } from "@/lib/http";

export async function GET() {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, type, icon, created_at FROM categories ORDER BY name",
    );
    return ok(rows);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, type, icon } = body ?? {};

    if (!name || typeof name !== "string") {
      return badRequest("name is required");
    }

    const { rows } = await pool.query(
      `INSERT INTO categories (name, type, icon)
       VALUES ($1, $2, $3)
       RETURNING id, name, type, icon, created_at`,
      [name, type ?? null, icon ?? null],
    );
    return ok(rows[0], 201);
  } catch (error: any) {
    if (error?.code === "23505") {
      return conflict("A category with this name already exists");
    }
    return serverError(error);
  }
}
