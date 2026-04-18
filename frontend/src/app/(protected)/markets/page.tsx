"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { Market, MarketListResponse } from "@/lib/types";
import { useMarketStore } from "@/store/market";
import { useSocketStore } from "@/store/socket";
import { useT } from "@/i18n";

function formatDeadline(deadline: string): string {
  return new Date(deadline).toLocaleString();
}

function marketCardBg(status: string, isOwnMarket = false): string {
  if (status === "pending_resolution")
    return isOwnMarket ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20" : "border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20";
  if (status === "proposer_resolved") return "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20";
  if (status === "disputed") return "border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20";
  if (status === "closed") return "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20";
  return "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800";
}

function marketStatusBadge(status: string, isOwnMarket = false, t?: (key: any) => string): { text: string; cls: string } | null {
  const tr = t ?? ((k: string) => k);
  if (status === "pending_resolution")
    return isOwnMarket
      ? { text: tr("market.status_make_resolution"), cls: "bg-red-200 dark:bg-red-900/30 text-red-800 dark:text-red-300" }
      : { text: tr("market.status_pending"), cls: "bg-yellow-200 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300" };
  if (status === "proposer_resolved") return { text: tr("market.status_proposed"), cls: "bg-blue-200 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300" };
  if (status === "disputed") return { text: tr("market.status_disputed"), cls: "bg-violet-200 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300" };
  if (status === "closed") return { text: tr("market.status_closed"), cls: "bg-green-200 dark:bg-green-900/30 text-green-800 dark:text-green-300" };
  return null;
}

function MarketCard({ market }: { market: Market }) {
  const t = useT();
  const queryClient = useQueryClient();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const currentUser = useAuthStore((s) => s.user);
  const upvote = useMutation({
    mutationFn: () => api.post(`/api/markets/${market.id}/upvote`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["markets"] });
      await bootstrap();
    },
  });

  const isOwnMarket = currentUser?.id === market.proposer_id;
  const badge = marketStatusBadge(market.status, isOwnMarket, t);

  return (
    <Link
      href={`/markets/${market.id}`}
      className={`block rounded border p-4 hover:border-gray-300 dark:hover:border-gray-600 ${marketCardBg(market.status, isOwnMarket)}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            @{market.proposer_username || "unknown"}
          </p>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{market.title}</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{market.description}</p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t("markets.deadline")}: {formatDeadline(market.deadline)}</p>
          {badge && (
            <span className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>
              {badge.text}
            </span>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1 text-right text-sm">
          {market.market_type === "binary" && (
            <>
              <p className="font-semibold text-green-600 dark:text-green-400">YES {market.yes_pct}%</p>
              <p className="font-semibold text-red-600 dark:text-red-400">NO {market.no_pct}%</p>
            </>
          )}
          {market.market_type === "multiple_choice" && (
            <p className="font-semibold text-blue-600 dark:text-blue-400">{(market.choices ?? []).length} {t("markets.choices")}</p>
          )}
          {market.market_type === "numeric" && (
            <p className="font-semibold text-purple-600 dark:text-purple-400">
              {market.numeric_min} – {market.numeric_max}
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {market.position_count} {t("markets.votes")} · {market.comment_count} {t("markets.comments")}
          </p>
          <button
            onClick={(e) => {
              e.preventDefault();
              upvote.mutate();
            }}
            disabled={upvote.isPending}
            className="mt-1 rounded border border-gray-300 dark:border-gray-600 px-2 py-0.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            ▲ {market.upvote_count}
          </button>
        </div>
      </div>
    </Link>
  );
}

export default function MarketsPage() {
  const t = useT();
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

  const queryClient = useQueryClient();
  const socket = useSocketStore((s) => s.socket);

  // Refresh listing when any market status changes (real-time)
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ["markets"] });
    };
    socket.on("bet:status_changed", handler);
    socket.on("bet:resolved", handler);
    return () => {
      socket.off("bet:status_changed", handler);
      socket.off("bet:resolved", handler);
    };
  }, [socket, queryClient]);

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
        <h1 className="text-2xl font-bold">{t("markets.title")}</h1>
        <Link
          href="/markets/new"
          title="Cost: 1 BP"
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          {t("markets.create")}
        </Link>
      </div>

      {/* Search */}
      <div className="space-y-1.5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("markets.search_placeholder")}
          className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={includeDesc}
            onChange={(e) => setIncludeDesc(e.target.checked)}
            className="rounded"
          />
          {t("markets.include_desc_search")}
        </label>
      </div>

      {/* Sort + Filter row */}
      <div className="flex flex-wrap items-start gap-4">
        {/* Sort */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t("markets.sort_by")}</span>
          <div className="flex gap-1.5">
            {(["active", "newest", "deadline"] as const).map((s) => {
              const isActive = sort === s;
              const arrow = isActive ? (sortDir === "asc" ? " ↑" : " ↓") : "";
              const sortLabels: Record<string, string> = { active: t("markets.sort_hot"), newest: t("markets.sort_new"), deadline: t("markets.sort_closing") };
              return (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                  }`}
                >
                  {sortLabels[s]}{arrow}
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px self-stretch bg-gray-200 dark:bg-gray-700 my-0.5" />

        {/* Filter */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t("markets.filter")}</span>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "my_bets", "open", "disputed", "resolved"] as const).map((f) => {
              const isActive = filter === f;
              const filterLabels: Record<string, string> = { all: t("markets.filter_all"), my_bets: t("markets.filter_my_bets"), open: t("markets.filter_open"), disputed: t("markets.filter_disputed"), resolved: t("markets.filter_resolved") };
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {filterLabels[f]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading && <p className="text-sm text-gray-500 dark:text-gray-400">{t("markets.loading")}</p>}
      {isError && <p className="text-sm text-red-600 dark:text-red-400">{t("markets.load_error")}</p>}

      <div className="space-y-3">
        {data?.items.map((market) => (
          <MarketCard key={market.id} market={market} />
        ))}
        {data?.items.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("markets.no_match")}</p>
        )}
      </div>

      {/* Pagination */}
      {!!data && data.pages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-3 text-sm">
          <span>
            {t("markets.page_of", { page: data.page, pages: data.pages })}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1 disabled:opacity-50 dark:text-gray-300"
            >
              {t("markets.prev")}
            </button>
            <button
              onClick={() => setPage(Math.min(data.pages, page + 1))}
              disabled={page >= data.pages}
              className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1 disabled:opacity-50 dark:text-gray-300"
            >
              {t("markets.next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
