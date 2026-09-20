export type Category = {
  id: string;
  name: string;
  type: string | null;
  icon: string | null;
  created_at: string;
};

export type Store = {
  id: string;
  name: string;
  default_category_id: string | null;
  logo_url: string | null;
  aliases: string[];
};

export type TransactionType =
  | "purchase"
  | "bill_payment"
  | "transfer_out"
  | "transfer_in"
  | "refund";

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  purchase: "شراء",
  bill_payment: "دفع فاتورة",
  transfer_out: "تحويل صادر",
  transfer_in: "تحويل وارد",
  refund: "استرجاع",
};

export type Expense = {
  id: string;
  amount: string;
  description: string | null;
  date: string;
  category_id: string | null;
  category_name: string | null;
  store_id: string | null;
  store_name: string | null;
  transaction_type: TransactionType;
  source: string;
  created_at: string;
  updated_at: string;
};

export type BudgetStatus = {
  budget_id: string;
  category_id: string;
  category_name: string;
  month_year: string;
  amount_limit: string;
  spent: string;
  remaining: string;
};
