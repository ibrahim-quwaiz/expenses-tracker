import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const client = new Anthropic();

export const SmsExtractionSchema = z.object({
  amount: z.number(),
  merchant: z.string(),
  date: z.string(), // YYYY-MM-DD
  transaction_type: z.enum([
    "purchase",
    "bill_payment",
    "transfer_out",
    "transfer_in",
    "refund",
  ]),
  card_last4: z
    .string()
    .nullable()
    .describe(
      "The last 4 digits of the card or account number mentioned in the message (e.g. from phrasing like " +
        "'بطاقة تنتهي بـ 1234' or 'account ending 1234'), as a 4-digit string. Null if no such number is " +
        "mentioned in the message.",
    ),
  raw_text: z
    .string()
    .describe(
      "The exact original SMS message text this transaction was extracted from, copied verbatim " +
        "(used to detect duplicate submissions of the same message)",
    ),
});

export type SmsExtraction = z.infer<typeof SmsExtractionSchema>;

const SmsBatchSchema = z.object({
  transactions: z.array(SmsExtractionSchema),
});

/**
 * Extracts one or more transactions from a block of text that may contain several bank SMS
 * notifications pasted together (separated by blank lines, or simply concatenated).
 */
export async function extractExpensesFromSms(smsText: string): Promise<SmsExtraction[]> {
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 4000,
    system:
      "You extract structured expense data from Arabic or English bank SMS notifications. The user may paste " +
      "ONE OR MORE separate SMS messages in a single block of text, often separated by blank lines or simply " +
      "concatenated one after another. Identify each distinct transaction message and return one entry per " +
      "transaction in the `transactions` array (an input with a single message still returns an array with one " +
      "item). For each entry, `raw_text` must be the exact verbatim substring of the input for that specific " +
      "message — copy it exactly, do not paraphrase, translate, or trim it. Use today's date only if a message " +
      "has no date. Amount must be a positive number without currency symbols. Pick transaction_type based on " +
      "the wording: purchases/POS -> purchase, bill/invoice payments -> bill_payment, outgoing transfers -> " +
      "transfer_out, incoming transfers -> transfer_in, refunds/reversals -> refund. Also extract card_last4 " +
      "if the message mentions the last 4 digits of a card or account number.",
    messages: [{ role: "user", content: smsText }],
    output_config: {
      format: zodOutputFormat(SmsBatchSchema),
    },
  });

  if (!response.parsed_output || response.parsed_output.transactions.length === 0) {
    throw new Error("Claude failed to extract structured data from the SMS text");
  }

  return response.parsed_output.transactions;
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
