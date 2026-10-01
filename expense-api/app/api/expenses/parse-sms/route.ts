import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { extractExpensesFromSms, type SmsContext } from "@/lib/claude";
import { ok, badRequest, serverError } from "@/lib/http";
import { categorySuggestionsForStores, storeIdsForMerchant } from "@/lib/categorySuggestions";

/**
 * Fallback when Claude can't tell the account: match the digit groups of the number as written
 * (e.g. "109*397") against the registered numbers ("0109"). Only an unambiguous match counts.
 */
function accountByNumberText(text: string | null, accounts: SmsContext["accounts"]): string | null {
  const groups = text?.match(/\d{3,}/g) ?? [];
  if (groups.length === 0) return null;
  const matches = accounts.filter((a) =>
    a.card_last4.some((n) => groups.some((g) => n.endsWith(g) || g.endsWith(n))),
  );
  return matches.length === 1 ? matches[0].id : null;
}

async function loadSmsContext(): Promise<SmsContext> {
  const [accounts, categories] = await Promise.all([
    pool.query("SELECT id, name, card_last4 FROM accounts ORDER BY created_at, id"),
    pool.query(
      `SELECT c.id, CASE WHEN p.name IS NULL THEN c.name ELSE p.name || ' ← ' || c.name END AS label
       FROM categories c LEFT JOIN categories p ON p.id = c.parent_category_id
       ORDER BY coalesce(p.name, c.name), p.name NULLS FIRST, c.name`,
    ),
  ]);
  return {
    accounts: accounts.rows.map((a) => ({ id: a.id, name: a.name, card_last4: a.card_last4 ?? [] })),
    categories: categories.rows,
  };
}

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

    const context = await loadSmsContext();
    const extracted = await extractExpensesFromSms(sms_text, context);

    const results = await Promise.all(
      extracted.map(async (item) => {
        const rawSmsHash = createHash("sha256").update(item.raw_text.trim()).digest("hex");

        const existing = await pool.query("SELECT id FROM expenses WHERE raw_sms_hash = $1", [rawSmsHash]);

        const storeIds = await storeIdsForMerchant(item.merchant);
        const suggestedCategoryIds = await categorySuggestionsForStores(storeIds);

        let matchedAccountId = item.account_id ?? accountByNumberText(item.account_number_text, context.accounts);
        if (matchedAccountId === item.counterparty_account_id) matchedAccountId = null;

        return {
          extracted: {
            amount: item.amount,
            fee: item.fee,
            merchant: item.merchant,
            date: item.date,
            time: item.time,
            transaction_type: item.transaction_type,
          },
          raw_sms_hash: rawSmsHash,
          matched_store_id: storeIds[0] ?? null,
          // History with this store wins; Claude's guess only fills in for stores with none.
          matched_category_id: suggestedCategoryIds[0] ?? item.suggested_category_id,
          suggested_category_ids: suggestedCategoryIds,
          matched_account_id: matchedAccountId,
          account_number_text: item.account_number_text,
          counterparty_account_id: item.counterparty_account_id,
          duplicate: existing.rows.length > 0,
        };
      }),
    );

    return ok({ results });
  } catch (error) {
    return serverError(error);
  }
}
