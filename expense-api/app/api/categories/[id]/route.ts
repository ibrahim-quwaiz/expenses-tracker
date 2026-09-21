import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, notFound, serverError, conflict } from "@/lib/http";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { name, type, icon, parent_category_id } = body ?? {};

    if (!name || typeof name !== "string") {
      return badRequest("name is required");
    }

    if (parent_category_id) {
      if (parent_category_id === id) {
        return badRequest("a category cannot be its own parent");
      }
      const parent = await pool.query("SELECT parent_category_id FROM categories WHERE id = $1", [
        parent_category_id,
      ]);
      if (parent.rows.length === 0) {
        return badRequest("parent_category_id does not reference an existing category");
      }
      if (parent.rows[0].parent_category_id) {
        return badRequest("only two levels of categories are supported — the parent must be a top-level category");
      }
      const children = await pool.query(
        "SELECT id FROM categories WHERE parent_category_id = $1 LIMIT 1",
        [id],
      );
      if (children.rows.length > 0) {
        return badRequest("this category already has subcategories — it cannot also become a subcategory");
      }
    }

    const { rows } = await pool.query(
      `UPDATE categories SET name = $1, type = $2, icon = $3, parent_category_id = $4
       WHERE id = $5
       RETURNING id, name, type, icon, parent_category_id, created_at`,
      [name, type ?? null, icon ?? null, parent_category_id ?? null, id],
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
