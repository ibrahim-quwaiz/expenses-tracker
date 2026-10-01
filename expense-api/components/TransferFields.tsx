import type { Account } from "@/lib/types";

/** "To account" and fee rows shown under the "from account" row of a transfer between own accounts. */
export default function TransferFields({
  accounts,
  fromAccountId,
  toAccountId,
  onToAccountChange,
  fee,
  onFeeChange,
  compact = false,
}: {
  accounts: Account[];
  fromAccountId: string;
  toAccountId: string;
  onToAccountChange: (id: string) => void;
  fee: string;
  onFeeChange: (fee: string) => void;
  compact?: boolean;
}) {
  const text = compact ? "text-[13.5px]" : "text-[14.5px]";
  const row = `flex items-center justify-between px-3.5 ${compact ? "py-2.5" : "py-3"}`;
  return (
    <>
      <div className="h-px bg-separator mr-3.5" />
      <div className={row}>
        <label className={text}>إلى حساب</label>
        <select
          value={toAccountId}
          onChange={(e) => onToAccountChange(e.target.value)}
          className={`bg-transparent ${text} text-ink-muted text-right border-none outline-none`}
        >
          {!toAccountId && <option value="" disabled hidden>اختر الحساب</option>}
          {accounts
            .filter((a) => a.id !== fromAccountId)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
      </div>
      <div className="h-px bg-separator mr-3.5" />
      <div className={`flex items-center px-3.5 ${compact ? "py-2.5" : "py-3"}`}>
        <label className={`w-[88px] flex-shrink-0 ${text}`}>الرسوم</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={fee}
          onChange={(e) => onFeeChange(e.target.value)}
          placeholder="0.00"
          className={`flex-1 border-none bg-transparent ${text} text-ink text-right outline-none`}
        />
      </div>
      <div className={`px-3.5 pb-2.5 -mt-1 text-[11.5px] text-ink-faint`}>
        المبلغ يدخل الحساب المستلم كما هو، والرسوم تُخصم من الحساب المرسِل فقط
      </div>
    </>
  );
}

/** Client-side checks shared by the forms; returns an error message or null. */
export function transferError(fromAccountId: string, toAccountId: string, fee: string): string | null {
  if (!toAccountId) return "اختر الحساب المستلم";
  if (toAccountId === fromAccountId) return "الحساب المستلم لازم يختلف عن المرسِل";
  if (fee && !(parseFloat(fee) >= 0)) return "أدخل رسومًا صحيحة";
  return null;
}
