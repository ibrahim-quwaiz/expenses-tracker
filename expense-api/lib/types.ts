export type Category = {
  id: string;
  name: string;
  type: string | null;
  icon: string | null;
  parent_category_id: string | null;
  created_at: string;
};

export type Account = {
  id: string;
  name: string;
  account_number: string | null;
  balance: string;
  created_at: string;
  updated_at: string;
};

export const PAYMENT_METHODS = ["مدى", "فيزا", "تحويل", "كاش"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

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
  store_logo_url: string | null;
  account_id: string | null;
  account_name: string | null;
  payment_method: string | null;
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
