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
