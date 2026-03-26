"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { Market, MarketListResponse } from "@/lib/types";
import { useMarketStore } from "@/store/market";

function formatDeadline(deadline: string): string {
  return new Date(deadline).toLocaleString();
}

function MarketCard({ market }: { market: Market }) {
  const queryClient = useQueryClient();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const upvote = useMutation({
    mutationFn: () => api.post(`/api/markets/${market.id}/upvote`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["markets"] });
      await bootstrap();
    },
  });

  return (
    <Link
      href={`/markets/${market.id}`}
      className="block rounded border border-gray-200 bg-white p-4 hover:border-gray-300"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{market.title}</h2>
          <p className="mt-1 text-sm text-gray-600">{market.description}</p>
          <p className="mt-2 text-xs text-gray-500">Deadline: {formatDeadline(market.deadline)}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1 text-right text-sm">
          {market.market_type === "binary" && (
            <>
              <p className="font-semibold text-green-600">YES {market.yes_pct}%</p>
              <p className="font-semibold text-red-600">NO {market.no_pct}%</p>
            </>
          )}
          {market.market_type === "multiple_choice" && (
            <p className="font-semibold text-blue-600">{(market.choices ?? []).length} choices</p>
          )}
          {market.market_type === "numeric" && (
            <p className="font-semibold text-purple-600">
              {market.numeric_min} – {market.numeric_max}
            </p>
          )}
          <p className="text-xs text-gray-500">
            {market.position_count} votes · {market.comment_count} comments
          </p>
          <button
            onClick={(e) => {
              e.preventDefault();
              upvote.mutate();
            }}
            disabled={upvote.isPending}
            className="mt-1 rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100 disabled:opacity-50"
          >
            ▲ {market.upvote_count}
          </button>
        </div>
      </div>
    </Link>
  );
}

const SORT_LABELS: Record<string, string> = {
  active: "Hot",
  newest: "New",
  deadline: "Closing",
};

const FILTER_LABELS: Record<string, string> = {
  all: "All",
  my_bets: "My Bets",
  open: "Open",
  closed: "Closed",
  resolved: "Resolved",
};

export default function MarketsPage() {
  const {
    sort,
    sortDir,
    filter,
    search,
    includeDesc,
    page,
    setSort,
    setFilter,
    setSearch,
    setIncludeDesc,
    setPage,
  } = useMarketStore();

  const { data, isLoading, isError } = useQuery<MarketListResponse>({
    queryKey: ["markets", sort, sortDir, filter, search, includeDesc, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        sort,
        sort_dir: sortDir,
        status: filter === "my_bets" ? "all" : filter,
        my_bets: String(filter === "my_bets"),
        q: search,
        include_desc: String(includeDesc),
        page: String(page),
        limit: "20",
      });
      const response = await api.get<MarketListResponse>(`/api/markets?${params}`);
      return response.data;
    },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Markets</h1>
        <Link
          href="/markets/new"
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Create Market
        </Link>
      </div>

      {/* Search */}
      <div className="space-y-1.5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search markets..."
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={includeDesc}
            onChange={(e) => setIncludeDesc(e.target.checked)}
            className="rounded"
          />
          Include description &amp; resolution criteria in search
        </label>
      </div>

      {/* Sort + Filter row */}
      <div className="flex flex-wrap items-start gap-4">
        {/* Sort */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sort by</span>
          <div className="flex gap-1.5">
            {(["active", "newest", "deadline"] as const).map((s) => {
              const active = sort === s;
              const arrow = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";
              return (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-600 text-white"
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  {SORT_LABELS[s]}{arrow}
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px self-stretch bg-gray-200 my-0.5" />

        {/* Filter */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Filter</span>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "my_bets", "open", "closed", "resolved"] as const).map((f) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                    active
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {FILTER_LABELS[f]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading && <p className="text-sm text-gray-500">Loading markets...</p>}
      {isError && <p className="text-sm text-red-600">Failed to load markets.</p>}

      <div className="space-y-3">
        {data?.items.map((market) => (
          <MarketCard key={market.id} market={market} />
        ))}
        {data?.items.length === 0 && (
          <p className="text-sm text-gray-500">No markets match your criteria.</p>
        )}
      </div>

      {/* Pagination */}
      {!!data && data.pages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-sm">
          <span>
            Page {data.page} / {data.pages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(Math.min(data.pages, page + 1))}
              disabled={page >= data.pages}
              className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
