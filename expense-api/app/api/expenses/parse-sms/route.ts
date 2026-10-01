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

type Transfer = {
  from_account_id: string | null;
  to_account_id: string | null;
  amount: number;
  fee: number;
  paired_sms_hash: string | null;
  existing_transfer_id: string | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Amounts of the two sides of one transfer can differ by a fee the sending bank folded in. */
const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(5, 0.02 * Math.max(a, b));
const daysApart = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

/** An internal transfer saved earlier (e.g. from the other side's message) that this one likely repeats. */
async function existingTransferId(t: Transfer, date: string): Promise<string | null> {
  if (!t.from_account_id && !t.to_account_id) return null;
  const { rows } = await pool.query(
    `SELECT id, amount, fee FROM expenses
     WHERE transaction_type = 'internal_transfer'
       AND ($1::uuid IS NULL OR account_id = $1) AND ($2::uuid IS NULL OR to_account_id = $2)
       AND date >= $3::date - 1 AND date < $3::date + 2
     ORDER BY date DESC`,
    [t.from_account_id, t.to_account_id, date],
  );
  const total = t.amount + t.fee;
  const match = rows.find((r) => near(total, Number(r.amount)) || near(total, Number(r.amount) + Number(r.fee)));
  return match?.id ?? null;
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

        const existing = await pool.query(
          "SELECT id FROM expenses WHERE raw_sms_hash = $1 OR paired_sms_hash = $1",
          [rawSmsHash],
        );

        const storeIds = await storeIdsForMerchant(item.merchant);
        const suggestedCategoryIds = await categorySuggestionsForStores(storeIds);

        let matchedAccountId = item.account_id ?? accountByNumberText(item.account_number_text, context.accounts);
        if (matchedAccountId === item.counterparty_account_id) matchedAccountId = null;

        // The other side is one of the user's own accounts: offer it as one internal transfer.
        const incoming = item.transaction_type === "transfer_in" || item.transaction_type === "refund";
        const transfer: Transfer | null = item.counterparty_account_id
          ? {
              from_account_id: incoming ? item.counterparty_account_id : matchedAccountId,
              to_account_id: incoming ? matchedAccountId : item.counterparty_account_id,
              amount: item.amount,
              fee: item.fee ?? 0,
              paired_sms_hash: null,
              existing_transfer_id: null,
            }
          : null;

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
          transfer,
          duplicate: existing.rows.length > 0,
        };
      }),
    );

    // Both sides of the same transfer pasted together: merge the receiving side into the sending
    // side. The received amount is what moved; any difference is the sending bank's fee.
    const merged = new Set<string>();
    for (const out of results) {
      const o = out.transfer;
      if (!o || out.duplicate || out.extracted.transaction_type === "transfer_in") continue;
      const sent = o.amount + o.fee;
      const match = results.find((r) => {
        const i = r.transfer;
        if (!i || r === out || r.duplicate || merged.has(r.raw_sms_hash)) return false;
        if (r.extracted.transaction_type !== "transfer_in") return false;
        const sameFrom = !o.from_account_id || !i.from_account_id || o.from_account_id === i.from_account_id;
        const sameTo = !o.to_account_id || !i.to_account_id || o.to_account_id === i.to_account_id;
        const anchored =
          (o.from_account_id && o.from_account_id === i.from_account_id) ||
          (o.to_account_id && o.to_account_id === i.to_account_id);
        return (
          sameFrom && sameTo && Boolean(anchored) && sent >= i.amount && near(sent, i.amount) &&
          daysApart(out.extracted.date, r.extracted.date) <= 1
        );
      });
      if (!match?.transfer) continue;
      merged.add(match.raw_sms_hash);
      out.transfer = {
        from_account_id: o.from_account_id ?? match.transfer.from_account_id,
        to_account_id: o.to_account_id ?? match.transfer.to_account_id,
        amount: match.transfer.amount,
        fee: round2(sent - match.transfer.amount),
        paired_sms_hash: match.raw_sms_hash,
        existing_transfer_id: null,
      };
    }
    const final = results.filter((r) => !merged.has(r.raw_sms_hash));

    await Promise.all(
      final.map(async (r) => {
        if (r.transfer && !r.duplicate) {
          r.transfer.existing_transfer_id = await existingTransferId(r.transfer, r.extracted.date);
        }
      }),
    );

    return ok({ results: final });
  } catch (error) {
    return serverError(error);
  }
}
