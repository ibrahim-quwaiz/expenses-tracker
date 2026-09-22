import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { extractExpensesFromSms } from "@/lib/claude";
import { ok, badRequest, serverError } from "@/lib/http";

const normalize = (s: string) => s.trim().toUpperCase();

/**
 * Preview-only: extracts one or more transactions from the pasted SMS text via Claude and looks
 * up a matching store for each, but does NOT write anything to the database. The caller reviews
 * or edits each result and saves the ones it wants via POST /api/expenses/parse-sms/confirm.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sms_text } = body ?? {};

    if (!sms_text || typeof sms_text !== "string" || !sms_text.trim()) {
      return badRequest("sms_text is required");
    }

    const extracted = await extractExpensesFromSms(sms_text);

    const results = await Promise.all(
      extracted.map(async (item) => {
        const rawSmsHash = createHash("sha256").update(item.raw_text.trim()).digest("hex");

        const existing = await pool.query("SELECT id FROM expenses WHERE raw_sms_hash = $1", [rawSmsHash]);

        const pattern = normalize(item.merchant);
        const aliasMatch = await pool.query(
          `SELECT s.id, s.default_category_id
           FROM store_aliases sa JOIN stores s ON s.id = sa.store_id
           WHERE sa.raw_pattern = $1`,
          [pattern],
        );
        const matchedStore = aliasMatch.rows[0] ?? null;

        let matchedAccountId: string | null = null;
        if (item.card_last4) {
          const accountMatch = await pool.query(
            "SELECT id FROM accounts WHERE $1 = ANY(card_last4) LIMIT 1",
            [item.card_last4],
          );
          matchedAccountId = accountMatch.rows[0]?.id ?? null;
        }

        return {
          extracted: {
            amount: item.amount,
            merchant: item.merchant,
            date: item.date,
            transaction_type: item.transaction_type,
          },
          raw_sms_hash: rawSmsHash,
          matched_store_id: matchedStore?.id ?? null,
          matched_category_id: matchedStore?.default_category_id ?? null,
          matched_account_id: matchedAccountId,
          duplicate: existing.rows.length > 0,
        };
      }),
    );

    return ok({ results });
  } catch (error) {
    return serverError(error);
  }
}
