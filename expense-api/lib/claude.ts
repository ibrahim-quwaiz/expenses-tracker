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
});

export type SmsExtraction = z.infer<typeof SmsExtractionSchema>;

export async function extractExpenseFromSms(smsText: string): Promise<SmsExtraction> {
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 2000,
    system:
      "You extract structured expense data from Arabic or English bank SMS notifications. " +
      "Use today's date only if the message has no date. Amount must be a positive number without currency symbols. " +
      "Pick transaction_type based on the wording: purchases/POS -> purchase, bill/invoice payments -> bill_payment, " +
      "outgoing transfers -> transfer_out, incoming transfers -> transfer_in, refunds/reversals -> refund.",
    messages: [{ role: "user", content: smsText }],
    output_config: {
      format: zodOutputFormat(SmsExtractionSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude failed to extract structured data from the SMS text");
  }

  return response.parsed_output;
}

const MerchantDomainSchema = z.object({
  domain: z
    .string()
    .nullable()
    .describe("The merchant's primary website domain (e.g. starbucks.com), or null if unknown/not a recognizable brand"),
});

/** Best-effort guess of a well-known merchant's website domain, used to fetch a logo. Returns null for unrecognized/local businesses. */
export async function guessMerchantDomain(merchantName: string): Promise<string | null> {
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 300,
      output_config: { effort: "low", format: zodOutputFormat(MerchantDomainSchema) },
      system:
        "Given a merchant/store name (often in Arabic, possibly a Saudi/Gulf business), return its official " +
        "website domain if it's a well-known local or international brand (e.g. 'ستاربكس' -> starbucks.com, " +
        "'البيك' -> albaik.com, 'نون' -> noon.com). Return null if the name is generic, unrecognizable, or " +
        "clearly a small/local/unbranded business.",
      messages: [{ role: "user", content: merchantName }],
    });
    return response.parsed_output?.domain ?? null;
  } catch {
    return null;
  }
}
