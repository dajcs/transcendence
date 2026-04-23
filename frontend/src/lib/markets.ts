import type { Market } from "@/lib/types";

const UUID_SUFFIX_RE =
  /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export function slugifyMarketTitle(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "market";
}

export function getMarketPath(
  market: Pick<Market, "id" | "title"> | { id: string; title?: string | null } | string,
  title?: string | null,
): string {
  if (typeof market === "string") {
    return title ? `/markets/${slugifyMarketTitle(title)}-${market}` : `/markets/${market}`;
  }

  return market.title
    ? `/markets/${slugifyMarketTitle(market.title)}-${market.id}`
    : `/markets/${market.id}`;
}

export function getMarketIdFromRouteParam(param: string | string[] | undefined): string {
  const raw = Array.isArray(param) ? param[0] : param;
  if (!raw) return "";

  const match = raw.match(UUID_SUFFIX_RE);
  return match?.[1] ?? raw;
}
