import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

const client = new Anthropic();

const SmsExtractionSchema = z.object({
  amount: z
    .number()
    .describe("The principal amount as a positive number, without currency symbols and excluding any separately stated fee"),
  fee: z
    .number()
    .nullable()
    .describe(
      "Total of any fees stated separately from the principal amount, including VAT on those fees " +
        "(e.g. 'رسوم SAR 0.5' and 'ضريبة SAR 0.08' -> 0.58). Null if the message states no separate fee.",
    ),
  merchant: z
    .string()
    .describe("The merchant for purchases/payments, or the other party's name for transfers"),
  date: z.string().describe("YYYY-MM-DD"),
  time: z
    .string()
    .nullable()
    .describe(
      "The time of day the transaction occurred, as mentioned in the message (24-hour HH:MM, local Saudi " +
        "time, e.g. '17:58'). Null if the message does not mention a time.",
    ),
  transaction_type: z
    .enum(["purchase", "bill_payment", "transfer_out", "transfer_in", "refund"])
    .describe("Direction relative to the user's own account in account_ref"),
  account_ref: z
    .string()
    .nullable()
    .describe(
      "Ref (e.g. 'A2') of the user's account that this message is about: the one money left for outgoing " +
        "transactions, or arrived in for incoming ones. Never the other party's account. Null if it cannot be identified.",
    ),
  account_number_text: z
    .string()
    .nullable()
    .describe(
      "The user's own account or card number exactly as written in the message (e.g. '109*397', '0109*', " +
        "'Mada-6476'). Null if the message shows no number for the user's side.",
    ),
  counterparty_ref: z
    .string()
    .nullable()
    .describe(
      "Ref of the user's account on the OTHER side of the transaction, when the other party is also one of " +
        "the user's accounts (a transfer or top-up between their own accounts). Null otherwise.",
    ),
  category_ref: z
    .string()
    .nullable()
    .describe(
      "Ref (e.g. 'C7') of the best-fitting category for this transaction, or null if unsure or if it is a " +
        "transfer between the user's own accounts",
    ),
  raw_text: z
    .string()
    .describe(
      "The exact original SMS message text this transaction was extracted from, copied verbatim " +
        "(used to detect duplicate submissions of the same message)",
    ),
});

const SmsBatchSchema = z.object({
  transactions: z.array(SmsExtractionSchema),
});

export type SmsContext = {
  accounts: { id: string; name: string; card_last4: string[] }[];
  /** Display label such as "سيارات ← صيانة". */
  categories: { id: string; label: string }[];
};

export type SmsTransaction = {
  amount: number;
  fee: number | null;
  merchant: string;
  date: string;
  time: string | null;
  transaction_type: z.infer<typeof SmsExtractionSchema>["transaction_type"];
  account_id: string | null;
  account_number_text: string | null;
  counterparty_account_id: string | null;
  suggested_category_id: string | null;
  raw_text: string;
};

const SMS_INSTRUCTIONS = `You extract structured transaction data from Arabic or English bank/wallet SMS notifications sent to a user in Saudi Arabia.

The user may paste ONE OR MORE separate SMS messages in one block, separated by blank lines or simply concatenated. Return one entry per transaction in \`transactions\` (a single message still returns an array with one item). \`raw_text\` must be the exact verbatim substring of the input for that message: do not paraphrase, translate, or trim it.

Dates in these messages are day-first (e.g. 01/10/26 is 1 October 2026). Use today's date only if a message has no date. Extract the time of day if one is mentioned.

The user's own accounts are listed below with a ref, a name, and the numbers registered for them (card or account endings). Each message is sent by the bank or wallet of exactly one of these accounts: that is account_ref. Rules for identifying it:
- Banks mask numbers differently. A number in the message matches a registered number when their visible digits overlap: '109*397', '0109*' and '*0109' all match 0109; 'Mada-6476', '*6476' and 'بطاقة:6476' match 6476. An account name in the message (e.g. 'urpay', 'STC Bank') also identifies an account.
- A message can contain the OTHER party's number, which must never become account_ref. In an incoming transfer, the number or name after 'من' is the SENDER. In an outgoing transfer, the number, IBAN or name after 'إلى' / 'لـ' / 'آيبان' is the RECIPIENT. If the other party is also one of the user's accounts, put it in counterparty_ref. If the only registered number in the message belongs to the other party, account_ref must be null unless another clue (such as a bank name) identifies the user's side.
- In purchase messages, 'من:' or 'لدى:' introduces the merchant (e.g. 'من:TABBY بطاقة:*6459' is a purchase at TABBY with the card 6459).
- Adding money to a wallet ('إضافة الأموال', 'شحن', 'Top-up', '... إلى: urpay') is incoming money for that wallet: transaction_type transfer_in, account_ref the wallet, counterparty_ref the account owning the card the money came from (if registered).

transaction_type is the direction for account_ref: purchases/POS/online -> purchase; bills, invoices, loan or financing installments -> bill_payment; money leaving by transfer -> transfer_out; money arriving (transfers, deposits, salary, top-ups) -> transfer_in; refunds/reversals -> refund.

amount is the principal only. If a fee (and VAT on the fee) is stated separately, put its total in fee.

For category_ref, pick the best-fitting category from the categories list based on the merchant and wording (prefer a subcategory; e.g. a financing installment -> personal financing, salary -> income). Use null when unsure, and for transfers between the user's own accounts.`;

function formatContext(ctx: SmsContext) {
  const accounts = ctx.accounts
    .map((a, i) => `A${i + 1}: ${a.name} (numbers: ${a.card_last4.join(", ") || "none"})`)
    .join("\n");
  const categories = ctx.categories.map((c, i) => `C${i + 1}: ${c.label}`).join("\n");
  return `<accounts>\n${accounts}\n</accounts>\n\n<categories>\n${categories}\n</categories>`;
}

function riyadhToday(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Extracts one or more transactions from a block of text that may contain several bank SMS
 * notifications pasted together, resolving the user's accounts and a suggested category.
 */
export async function extractExpensesFromSms(smsText: string, ctx: SmsContext): Promise<SmsTransaction[]> {
  const response = await client.beta.messages.parse({
    model: "claude-opus-5",
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: `${SMS_INSTRUCTIONS}\n\nToday's date: ${riyadhToday()}\n\n${formatContext(ctx)}`,
    messages: [{ role: "user", content: smsText }],
    output_config: { format: betaZodOutputFormat(SmsBatchSchema) },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("تعذر تحليل الرسالة، جرّب لصقها مرة ثانية أو أدخلها يدويًا");
  }
  if (!response.parsed_output || response.parsed_output.transactions.length === 0) {
    throw new Error("Claude failed to extract structured data from the SMS text");
  }

  const ref = <T extends { id: string }>(list: T[], prefix: string, value: string | null) => {
    const match = value?.trim().toUpperCase().match(new RegExp(`^${prefix}(\\d+)$`));
    return match ? (list[Number(match[1]) - 1]?.id ?? null) : null;
  };

  return response.parsed_output.transactions.map((t) => {
    const accountId = ref(ctx.accounts, "A", t.account_ref);
    const counterpartyId = ref(ctx.accounts, "A", t.counterparty_ref);
    return {
      amount: t.amount,
      fee: t.fee && t.fee > 0 ? t.fee : null,
      merchant: t.merchant,
      date: t.date,
      time: t.time,
      transaction_type: t.transaction_type,
      account_id: accountId,
      account_number_text: t.account_number_text,
      counterparty_account_id: counterpartyId !== accountId ? counterpartyId : null,
      suggested_category_id: ref(ctx.categories, "C", t.category_ref),
      raw_text: t.raw_text,
    };
  });
}

const MerchantBrandSchema = z.object({
  domain: z
    .string()
    .nullable()
    .describe("The merchant's primary website domain (e.g. starbucks.com), or null if unknown/not a recognizable brand"),
  english_name: z
    .string()
    .nullable()
    .describe(
      "The brand's official or commonly-known English name, suitable as a Wikipedia/Wikimedia Commons search " +
        "query (e.g. 'ستاربكس' -> 'Starbucks', 'العثيم' -> 'Al-Othaim Markets', 'بنده' -> 'Panda Retail Company'). " +
        "Null if unknown/not a recognizable brand.",
    ),
});

export type MerchantBrand = z.infer<typeof MerchantBrandSchema>;

/** Best-effort identification of a well-known merchant's brand, used to fetch a logo. Both fields null for unrecognized/local businesses. */
export async function identifyMerchantBrand(merchantName: string): Promise<MerchantBrand> {
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 300,
      output_config: { effort: "low", format: zodOutputFormat(MerchantBrandSchema) },
      system:
        "Given a merchant/store name (often in Arabic, possibly a Saudi/Gulf business), identify it if it's a " +
        "well-known local or international brand. Return null for both fields if the name is generic, " +
        "unrecognizable, or clearly a small/local/unbranded business.",
      messages: [{ role: "user", content: merchantName }],
    });
    return response.parsed_output ?? { domain: null, english_name: null };
  } catch {
    return { domain: null, english_name: null };
  }
}
