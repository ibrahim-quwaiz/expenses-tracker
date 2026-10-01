import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/http";
import { categorySuggestionsForStores, storeIdsForMerchant } from "@/lib/categorySuggestions";

export async function GET(req: NextRequest) {
  try {
    const merchant = req.nextUrl.searchParams.get("merchant") ?? "";
    const storeIds = await storeIdsForMerchant(merchant);
    return ok({ category_ids: await categorySuggestionsForStores(storeIds) });
  } catch (error) {
    return serverError(error);
  }
}
