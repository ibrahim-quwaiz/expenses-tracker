import type { PoolClient } from "pg";

const SIGN: Record<string, 1 | -1> = {
  purchase: -1,
  bill_payment: -1,
  transfer_out: -1,
  transfer_in: 1,
  refund: 1,
};

/** Signed effect of a transaction on an account's balance: negative debits it, positive credits it. */
export function balanceDelta(amount: number, transactionType: string): number {
  return (SIGN[transactionType] ?? -1) * amount;
}

export async function adjustAccountBalance(
  client: PoolClient,
  accountId: string | null | undefined,
  delta: number,
): Promise<void> {
  if (!accountId || delta === 0) return;
  await client.query("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [delta, accountId]);
}
