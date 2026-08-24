import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * /capital was renamed to /spend so the URL matches the nav and page title
 * ("Spend & Outcomes"). This redirect preserves the query string so existing
 * deep links — including the HydraDB canonical_url values that point at
 * /capital?mandate=… — keep working. See docs/UX_IA_REVIEW.md.
 */
export default async function CapitalRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => query.append(key, v));
    else query.set(key, value);
  }
  const qs = query.toString();
  redirect(qs ? `/spend?${qs}` : "/spend");
}
