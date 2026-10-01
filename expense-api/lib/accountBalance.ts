import type { PoolClient } from "pg";

const SIGN: Record<string, 1 | -1> = {
  purchase: -1,
  bill_payment: -1,
  transfer_out: -1,
  transfer_in: 1,
  refund: 1,
};

export type BalanceTx = {
  amount: number | string;
  fee?: number | string | null;
  transaction_type: string;
  account_id: string | null;
  to_account_id?: string | null;
};

/**
 * Signed effect of a transaction on each account it touches: negative debits, positive credits.
 * An internal transfer debits the source by amount + fee and credits the destination by amount.
 */
export function balanceEffects(tx: BalanceTx): [string, number][] {
  const amount = Number(tx.amount);
  if (tx.transaction_type === "internal_transfer") {
    const effects: [string, number][] = [];
    if (tx.account_id) effects.push([tx.account_id, -(amount + Number(tx.fee ?? 0))]);
    if (tx.to_account_id) effects.push([tx.to_account_id, amount]);
    return effects;
  }
  return tx.account_id ? [[tx.account_id, (SIGN[tx.transaction_type] ?? -1) * amount]] : [];
}

/** Net effect on one account, or on all accounts together when accountId is null. */
export function balanceDelta(tx: BalanceTx, accountId: string | null = null): number {
  return balanceEffects(tx)
    .filter(([id]) => accountId === null || id === accountId)
    .reduce((sum, [, d]) => sum + d, 0);
}

/** Applies a transaction's effects (direction 1) or reverses them (direction -1). */
export async function applyBalance(client: PoolClient, tx: BalanceTx, direction: 1 | -1): Promise<void> {
  for (const [accountId, delta] of balanceEffects(tx)) {
    if (delta === 0) continue;
    await client.query("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [direction * delta, accountId]);
  }
}
