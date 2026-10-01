export const VALID_TYPES = ["purchase", "bill_payment", "transfer_out", "transfer_in", "refund", "internal_transfer"];

export type TransactionInput = {
  amount: number;
  fee: number;
  description: string | null;
  date: string;
  time: string | null | undefined;
  category_id: string | null;
  store_id: string | null;
  account_id: string;
  to_account_id: string | null;
  payment_method: string | null;
  transaction_type: string;
};

/**
 * Validates the body of a create/update request. An internal transfer needs a different
 * destination account and carries no store or category; other types carry no destination or fee.
 */
export function parseTransactionInput(body: any): TransactionInput | string {
  const { amount, fee, description, date, time, category_id, store_id, account_id, to_account_id, payment_method } =
    body ?? {};
  const type = body?.transaction_type ?? "purchase";

  if (amount === undefined || amount === null || !(Number(amount) >= 0)) {
    return "amount must be a non-negative number";
  }
  if (!date) return "date is required";
  if (!account_id) return "account_id is required";
  if (!VALID_TYPES.includes(type)) return `transaction_type must be one of: ${VALID_TYPES.join(", ")}`;

  const internal = type === "internal_transfer";
  if (internal) {
    if (!to_account_id) return "to_account_id is required for an internal transfer";
    if (to_account_id === account_id) return "to_account_id must differ from account_id";
    if (fee != null && !(Number(fee) >= 0)) return "fee must be a non-negative number";
  }

  return {
    amount: Number(amount),
    fee: internal ? Number(fee ?? 0) : 0,
    description: description ?? null,
    date,
    time,
    category_id: internal ? null : (category_id ?? null),
    store_id: internal ? null : (store_id ?? null),
    account_id,
    to_account_id: internal ? to_account_id : null,
    payment_method: payment_method ?? null,
    transaction_type: type,
  };
}

/** Columns returned after an insert or update. */
export const RETURNING =
  "id, amount, fee, description, date, category_id, store_id, account_id, to_account_id, payment_method, transaction_type, source, created_at, updated_at";

/** Columns for reading transactions with their names joined in (aliases e, c, s, a, ta). */
export const SELECT_EXPENSE = `
  SELECT e.id, e.amount, e.fee, e.description, e.date, e.category_id, c.name AS category_name,
         e.store_id, s.name AS store_name, s.logo_url AS store_logo_url,
         e.account_id, a.name AS account_name, e.to_account_id, ta.name AS to_account_name,
         e.payment_method, e.transaction_type, e.source, e.created_at, e.updated_at
  FROM expenses e
  LEFT JOIN categories c ON c.id = e.category_id
  LEFT JOIN stores s ON s.id = e.store_id
  LEFT JOIN accounts a ON a.id = e.account_id
  LEFT JOIN accounts ta ON ta.id = e.to_account_id`;
