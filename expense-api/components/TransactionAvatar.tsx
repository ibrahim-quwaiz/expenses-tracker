import StoreAvatar from "@/components/StoreAvatar";
import { TransferIcon } from "@/components/icons";
import type { Expense } from "@/lib/types";

/** Store logo, or a transfer icon for a transfer between the user's own accounts. */
export default function TransactionAvatar({ expense, size = 34 }: { expense: Expense; size?: number }) {
  if (expense.transaction_type === "internal_transfer") {
    return (
      <div
        className="bg-fill text-primary flex items-center justify-center flex-shrink-0"
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.27) }}
      >
        <TransferIcon />
      </div>
    );
  }
  return <StoreAvatar name={expense.store_name} logoUrl={expense.store_logo_url} size={size} />;
}
