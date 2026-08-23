import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { ok, badRequest, notFound, serverError } from "@/lib/http";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { name, default_category_id, logo_url } = body ?? {};

    if (!name || typeof name !== "string") {
      return badRequest("name is required");
    }

    const { rows } = await pool.query(
      `UPDATE stores SET name = $1, default_category_id = $2, logo_url = $3
       WHERE id = $4
       RETURNING id, name, default_category_id, logo_url, created_at, updated_at`,
      [name, default_category_id ?? null, logo_url ?? null, id],
    );

    if (rows.length === 0) return notFound("Store not found");
    return ok(rows[0]);
  } catch (error) {
    return serverError(error);
  }
}
