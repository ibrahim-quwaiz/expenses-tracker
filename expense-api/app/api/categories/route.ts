import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, serverError, conflict } from "@/lib/http";

export async function GET() {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, type, icon, parent_category_id, created_at FROM categories ORDER BY name",
    );
    return ok(rows);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, type, icon, parent_category_id } = body ?? {};

    if (!name || typeof name !== "string") {
      return badRequest("name is required");
    }

    if (parent_category_id) {
      const parent = await pool.query("SELECT parent_category_id FROM categories WHERE id = $1", [
        parent_category_id,
      ]);
      if (parent.rows.length === 0) {
        return badRequest("parent_category_id does not reference an existing category");
      }
      if (parent.rows[0].parent_category_id) {
        return badRequest("only two levels of categories are supported — the parent must be a top-level category");
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO categories (name, type, icon, parent_category_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, type, icon, parent_category_id, created_at`,
      [name, type ?? null, icon ?? null, parent_category_id ?? null],
    );
    return ok(rows[0], 201);
  } catch (error: any) {
    if (error?.code === "23505") {
      return conflict("A category with this name already exists");
    }
    return serverError(error);
  }
}
