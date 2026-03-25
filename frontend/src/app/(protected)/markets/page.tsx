"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { Market, MarketListResponse } from "@/lib/types";
import { useMarketStore } from "@/store/market";

function formatDeadline(deadline: string): string {
  const date = new Date(deadline);
  return date.toLocaleString();
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
    <Link href={`/markets/${market.id}`} className="block rounded border border-gray-200 bg-white p-4 hover:border-gray-300">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{market.title}</h2>
          <p className="mt-1 text-sm text-gray-600">{market.description}</p>
          <p className="mt-2 text-xs text-gray-500">Deadline: {formatDeadline(market.deadline)}</p>
        </div>
        <div className="text-right text-sm shrink-0 flex flex-col items-end gap-1">
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
            <p className="font-semibold text-purple-600">{market.numeric_min} – {market.numeric_max}</p>
          )}
          <p className="text-xs text-gray-500">{market.position_count} votes · {market.comment_count} comments</p>
          <button
            onClick={(e) => { e.preventDefault(); upvote.mutate(); }}
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

export default function MarketsPage() {
  const { sort, filter, page, setSort, setFilter, setPage } = useMarketStore();

  const { data, isLoading, isError } = useQuery<MarketListResponse>({
    queryKey: ["markets", sort, filter, page],
    queryFn: async () => {
      const response = await api.get<MarketListResponse>(
        `/api/markets?sort=${sort}&status=${filter}&page=${page}&limit=20`
      );
      return response.data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Markets</h1>
        <Link href="/markets/new" className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
          Create Market
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "open", "resolved"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`rounded px-3 py-1 text-sm ${filter === status ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-700"}`}
          >
            {status}
          </button>
        ))}

        <div className="mx-2 h-6 w-px bg-gray-300" />

        {(["deadline", "active", "newest"] as const).map((sortOption) => (
          <button
            key={sortOption}
            onClick={() => setSort(sortOption)}
            className={`rounded px-3 py-1 text-sm ${sort === sortOption ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-800"}`}
          >
            {sortOption}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading markets...</p>}
      {isError && <p className="text-sm text-red-600">Failed to load markets.</p>}

      <div className="space-y-3">
        {data?.items.map((market) => (
          <MarketCard key={market.id} market={market} />
        ))}
      </div>

      {!!data && (
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
