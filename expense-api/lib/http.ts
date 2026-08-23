import { NextResponse } from "next/server";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status: 409 });
}

export function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  console.error(error);
  return NextResponse.json({ error: message }, { status: 500 });
}
