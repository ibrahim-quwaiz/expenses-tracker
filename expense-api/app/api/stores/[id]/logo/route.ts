import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { uploadLogo } from "@/lib/r2";
import { ok, badRequest, notFound, serverError } from "@/lib/http";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const existing = await pool.query("SELECT id FROM stores WHERE id = $1", [id]);
    if (existing.rows.length === 0) return notFound("Store not found");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("file is required");

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) return badRequest("file must be a PNG, JPEG, WEBP, or GIF image");
    if (file.size > MAX_SIZE) return badRequest("file must be 2MB or smaller");

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `logos/${id}-${randomUUID()}.${ext}`;
    const logoUrl = await uploadLogo(key, buffer, file.type);

    const { rows } = await pool.query(
      `UPDATE stores SET logo_url = $1 WHERE id = $2
       RETURNING id, name, default_category_id, logo_url, created_at, updated_at`,
      [logoUrl, id],
    );
    return ok(rows[0]);
  } catch (error) {
    return serverError(error);
  }
}
