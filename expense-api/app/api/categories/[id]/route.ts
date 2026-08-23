import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, notFound, serverError, conflict } from "@/lib/http";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { name, type, icon } = body ?? {};

    if (!name || typeof name !== "string") {
      return badRequest("name is required");
    }

    const { rows } = await pool.query(
      `UPDATE categories SET name = $1, type = $2, icon = $3
       WHERE id = $4
       RETURNING id, name, type, icon, created_at`,
      [name, type ?? null, icon ?? null, id],
    );

    if (rows.length === 0) return notFound("Category not found");
    return ok(rows[0]);
  } catch (error: any) {
    if (error?.code === "23505") {
      return conflict("A category with this name already exists");
    }
    return serverError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { rowCount } = await pool.query("DELETE FROM categories WHERE id = $1", [id]);
    if (rowCount === 0) return notFound("Category not found");
    return ok({ deleted: true });
  } catch (error) {
    return serverError(error);
  }
}
