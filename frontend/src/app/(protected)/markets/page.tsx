"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { getMarketPath } from "@/lib/markets";
import { useAuthStore } from "@/store/auth";
import type { Market, MarketListResponse } from "@/lib/types";
import { useMarketStore } from "@/store/market";
import { useSocketStore } from "@/store/socket";
import { useT } from "@/i18n";

// --- Avatar: deterministic color from username ---
const AVATAR_HUES = [40, 145, 160, 205, 264, 270, 310, 25, 320, 180];

function avatarColor(username: string): string {
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return `oklch(56% 0.2 ${AVATAR_HUES[hash % AVATAR_HUES.length]})`;
}

function Avatar({ username }: { username: string }) {
  return (
    <div
      style={{ background: avatarColor(username) }}
      className="w-[26px] h-[26px] rounded-full shrink-0 flex items-center justify-center text-white font-bold text-[12px]"
    >
      {(username[0] ?? "?").toUpperCase()}
    </div>
  );
}

function AvatarWithTooltip({
  username,
  mission,
  createdAt,
  profileHref,
}: {
  username: string;
  mission: string | null;
  createdAt: string | null;
  profileHref: string;
}) {
  const joined = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short" })
    : null;
  return (
    <div className="relative group/avatar shrink-0">
      <Link
        href={profileHref}
        onClick={(e) => e.stopPropagation()}
        className="block"
        tabIndex={0}
      >
        <Avatar username={username} />
      </Link>
      <div className="pointer-events-none absolute left-0 top-full mt-1.5 z-50 w-44 rounded-lg shadow-lg border border-gray-100 dark:border-[oklch(26%_0.015_250)] bg-white dark:bg-[oklch(18%_0.015_250)] p-2.5 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-150">
        <p className="text-[12px] font-semibold text-gray-900 dark:text-gray-100 truncate">@{username}</p>
        {mission && (
          <p className="text-[11px] text-gray-700 dark:text-gray-300 mt-0.5 line-clamp-2">{mission}</p>
        )}
        {joined && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Joined {joined}</p>
        )}
      </div>
    </div>
  );
}

// --- TimeClock: SSR-safe SVG pie for time remaining ---
function TimeClock({ createdAt, deadline }: { createdAt: string; deadline: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const end = new Date(deadline).getTime();

  if (!mounted) {
    return (
      <div className="flex flex-col items-center gap-0.5 w-11 shrink-0">
        <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700" />
        <span className="text-[10px] text-gray-400 dark:text-gray-500">…</span>
      </div>
    );
  }

  const now = Date.now();
  const start = new Date(createdAt).getTime();
  const total = end - start;
  const frac = total > 0 ? Math.max(0, Math.min(1, (now - start) / total)) : 1;
  const remaining = 1 - frac;

  const r = 9, cx = 10, cy = 10;
  const angle = remaining * 2 * Math.PI - Math.PI / 2;
  const x = cx + r * Math.cos(angle);
  const y = cy + r * Math.sin(angle);
  const large = remaining > 0.5 ? 1 : 0;

  const daysLeft = Math.max(0, Math.round((end - now) / 86400000));
  const label =
    daysLeft > 365 ? `${Math.round(daysLeft / 365)}y`
    : daysLeft > 30 ? `${Math.round(daysLeft / 30)}mo`
    : `${daysLeft}d`;

  const sliceColor =
    remaining > 0.6 ? "oklch(52% 0.18 145)"
    : remaining > 0.3 ? "oklch(58% 0.2 60)"
    : "oklch(55% 0.2 25)";

  return (
    <div className="flex flex-col items-center gap-0.5 w-11 shrink-0">
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx={cx} cy={cy} r={r} className="fill-[oklch(88%_0.005_250)] dark:fill-[oklch(30%_0.01_250)]" />
        {remaining > 0 && remaining < 1 ? (
          <path
            d={`M${cx},${cy} L${cx},${cy - r} A${r},${r} 0 ${large},1 ${x.toFixed(3)},${y.toFixed(3)} Z`}
            fill={sliceColor}
          />
        ) : remaining >= 1 ? (
          <circle cx={cx} cy={cy} r={r} fill={sliceColor} />
        ) : null}
        <circle cx={cx} cy={cy} r={r - 3} className="fill-white dark:fill-[oklch(18%_0.015_250)]" />
      </svg>
      <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

// --- Multi-choice color palette ---
const MULTI_COLORS = [
  "oklch(56% 0.2 264)",
  "oklch(56% 0.2 145)",
  "oklch(56% 0.2 25)",
  "oklch(56% 0.2 310)",
  "oklch(56% 0.2 50)",
  "oklch(56% 0.2 205)",
];

// --- Market outcome graphic ---
function MarketGraphic({ market }: { market: Market }) {
  if (market.market_type === "binary") {
    return (
      <div className="flex flex-col items-end gap-1 w-[84px] shrink-0">
        <div className="flex w-full h-2 rounded overflow-hidden bg-[oklch(90%_0.005_250)] dark:bg-[oklch(30%_0.01_250)]">
          <div
            style={{ width: `${market.yes_pct}%`, background: "oklch(52% 0.18 145)" }}
            className="transition-[width] duration-300"
          />
          <div style={{ width: `${market.no_pct}%`, background: "oklch(55% 0.2 25)" }} />
        </div>
        <span className="text-[11px] font-bold" style={{ color: "oklch(52% 0.18 145)" }}>
          {market.yes_pct}%
        </span>
      </div>
    );
  }

  if (market.market_type === "multiple_choice") {
    const choices = market.choices ?? [];
    const counts = market.choice_counts ?? {};
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    const pcts = choices.map((c) => Math.round(((counts[c] ?? 0) / total) * 100));
    return (
      <div className="flex flex-col items-end gap-1 w-[84px] shrink-0">
        <div className="flex w-full h-2 rounded overflow-hidden gap-px bg-[oklch(90%_0.005_250)] dark:bg-[oklch(30%_0.01_250)]">
          {pcts.map((pct, i) => (
            <div
              key={i}
              style={{ width: `${pct}%`, background: MULTI_COLORS[i % MULTI_COLORS.length] }}
              className="shrink-0"
            />
          ))}
        </div>
        <span className="text-[11px] font-semibold" style={{ color: "oklch(60% 0.12 264)" }}>
          {choices.length} {choices.length === 1 ? "option" : "options"}
        </span>
      </div>
    );
  }

  // numeric
  return (
    <div className="w-[84px] shrink-0 text-right">
      <span className="text-[13px] font-extrabold tracking-tight text-[var(--accent)]">
        {market.numeric_min}–{market.numeric_max}
      </span>
    </div>
  );
}

// --- Status badge ---
const STATUS_CLASSES: Record<string, string> = {
  open: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  pending: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  pending_resolution: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  proposer_resolved: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  disputed: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400",
  closed: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
};

function StatusBadge({ status, isOwn }: { status: string; isOwn: boolean }) {
  const t = useT();
  let text: string;
  if (status === "open") text = t("market.status_open");
  else if (status === "pending_resolution") text = isOwn ? t("market.status_make_resolution") : t("market.status_pending");
  else if (status === "proposer_resolved") text = t("market.status_proposed");
  else if (status === "disputed") text = t("market.status_disputed");
  else if (status === "closed") text = t("market.status_closed");
  else return null;

  const cls = STATUS_CLASSES[status] ?? STATUS_CLASSES.closed;

  return (
    <span className={`text-[10px] font-semibold px-1.5 py-px rounded-full ${cls}`}>
      {text}
    </span>
  );
}

// --- Individual market row ---
function MarketRow({ market, isLast }: { market: Market; isLast: boolean }) {
  const t = useT();
  const router = useRouter();
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
  const unlike = useMutation({
    mutationFn: () => api.delete(`/api/markets/${market.id}/upvote`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["markets"] });
      await bootstrap();
    },
  });

  const isOwn = currentUser?.id === market.proposer_id;

  const profileHref = `/profile/${encodeURIComponent(market.proposer_username || "")}`;

  return (
    <div
      onClick={() => router.push(getMarketPath(market))}
      className={`grid gap-x-3 px-3 py-2.5 items-center cursor-pointer hover:bg-[oklch(97%_0.008_264)] dark:hover:bg-[oklch(20%_0.015_250)] transition-colors duration-100 ${
        !isLast ? "border-b border-gray-100 dark:border-[oklch(22%_0.015_250)]" : ""
      }`}
      style={{ gridTemplateColumns: "1fr 110px 84px 44px" }}
    >
      {/* Col 1: avatar + title + stat pills */}
      <div className="flex gap-2.5 items-start min-w-0">
        <AvatarWithTooltip
          username={market.proposer_username || "?"}
          mission={market.proposer_mission ?? null}
          createdAt={market.proposer_created_at ?? null}
          profileHref={profileHref}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-gray-900 dark:text-gray-100 leading-[1.35] mb-1">
            {market.title}
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* participants */}
            <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              {market.position_count}
            </span>
            {/* comments */}
            <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {market.comment_count}
            </span>
            {/* likes */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                market.user_has_liked ? unlike.mutate() : upvote.mutate();
              }}
              disabled={upvote.isPending || unlike.isPending}
              className="flex items-center gap-1 text-[11px] disabled:opacity-50 transition-colors"
              style={market.user_has_liked ? { color: "oklch(55% 0.2 25)" } : undefined}
            >
              <svg
                width="11" height="11"
                fill={market.user_has_liked ? "currentColor" : "none"}
                stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                className={market.user_has_liked ? "" : "text-gray-400 dark:text-gray-500"}
                aria-hidden
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <span className={market.user_has_liked ? "" : "text-gray-400 dark:text-gray-500"}>
                {market.upvote_count}
              </span>
            </button>
            {/* status badge */}
            <StatusBadge status={market.status} isOwn={isOwn} />
          </div>
        </div>
      </div>

      {/* Col 2: activity numbers */}
      <div className="text-right flex flex-col items-end gap-0.5">
        <span className="text-[12px] font-bold text-gray-900 dark:text-gray-100">
          {market.position_count}{" "}
          <span className="font-normal text-gray-400 dark:text-gray-500">
            {t("markets.traders")}
          </span>
        </span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {market.comment_count} {t("markets.comments")}
        </span>
      </div>

      {/* Col 3: outcome graphic */}
      <div className="flex justify-end">
        <MarketGraphic market={market} />
      </div>

      {/* Col 4: time clock */}
      <div className="flex justify-center">
        <TimeClock createdAt={market.created_at} deadline={market.deadline} />
      </div>
    </div>
  );
}

// --- Page ---
export default function MarketsPage() {
  const t = useT();
  const {
    sort, sortDir, filter, search, includeDesc,
    setSort, setFilter, setSearch, setIncludeDesc,
  } = useMarketStore();

  const queryClient = useQueryClient();
  const socket = useSocketStore((s) => s.socket);

  useEffect(() => {
    if (!socket) return;
    const handler = () => queryClient.invalidateQueries({ queryKey: ["markets"] });
    socket.on("bet:status_changed", handler);
    socket.on("bet:resolved", handler);
    return () => {
      socket.off("bet:status_changed", handler);
      socket.off("bet:resolved", handler);
    };
  }, [socket, queryClient]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<MarketListResponse>({
    queryKey: ["markets", sort, sortDir, filter, search, includeDesc],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        sort,
        sort_dir: sortDir,
        status: filter === "my_bets" || filter === "liked" ? "all" : filter,
        my_bets: String(filter === "my_bets"),
        liked: String(filter === "liked"),
        q: search,
        include_desc: String(includeDesc),
        page: String(pageParam),
        limit: "20",
      });
      return (await api.get<MarketListResponse>(`/api/markets?${params}`)).data;
    },
    initialPageParam: 1,
    getNextPageParam: (last) => last.page < last.pages ? last.page + 1 : undefined,
  });

  const allMarkets = data?.pages.flatMap((p) => p.items) ?? [];

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const sortOptions = [
    { key: "active" as const, label: t("markets.sort_hot") },
    { key: "newest" as const, label: t("markets.sort_new") },
    { key: "deadline" as const, label: t("markets.sort_closing") },
  ];

  const filterOptions = [
    { key: "all" as const, label: t("markets.filter_all") },
    { key: "my_bets" as const, label: t("markets.filter_my_bets") },
    { key: "open" as const, label: t("markets.filter_open") },
    { key: "disputed" as const, label: t("markets.filter_disputed") },
    { key: "resolved" as const, label: t("markets.filter_resolved") },
    { key: "liked" as const, label: t("markets.filter_liked") },
  ];

  return (
    <div>
      {/* Header: search + create */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-[480px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 opacity-35 pointer-events-none text-gray-900 dark:text-gray-100"
            width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("markets.search_placeholder")}
            className="w-full pl-8 pr-3 py-2 rounded-lg text-[13px] bg-[oklch(97%_0.005_250)] dark:bg-[oklch(20%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(24%_0.015_250)] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
        <Link
          href="/markets/new"
          title={t("markets.create_cost")}
          className="shrink-0 px-3.5 py-2 rounded-lg text-[13px] font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
        >
          + {t("markets.create")}
        </Link>
      </div>

      {/* Include description toggle */}
      <label className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 cursor-pointer mb-3 w-fit">
        <input
          type="checkbox"
          checked={includeDesc}
          onChange={(e) => setIncludeDesc(e.target.checked)}
          className="rounded"
        />
        {t("markets.include_desc_search")}
      </label>

      {/* Sort + Filter row */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {sortOptions.map(({ key, label }) => {
          const isActive = sort === key;
          const arrow = isActive ? (sortDir === "asc" ? " ↑" : " ↓") : "";
          return (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`text-[12px] px-2.5 py-[5px] rounded-md cursor-pointer whitespace-nowrap border transition-colors ${
                isActive
                  ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-bold"
                  : "bg-transparent border-[oklch(91%_0.006_250)] dark:border-[oklch(24%_0.015_250)] text-gray-400 dark:text-gray-500 font-medium"
              }`}
            >
              {label}{arrow}
            </button>
          );
        })}
        <div className="w-px h-3.5 bg-[oklch(91%_0.006_250)] dark:bg-[oklch(24%_0.015_250)] mx-0.5" />
        {filterOptions.map(({ key, label }) => {
          const isActive = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`text-[12px] px-2.5 py-[5px] rounded-md cursor-pointer whitespace-nowrap border transition-colors ${
                isActive
                  ? "bg-[oklch(91%_0.006_250)] dark:bg-[oklch(24%_0.015_250)] border-[oklch(88%_0.005_250)] dark:border-[oklch(28%_0.015_250)] text-gray-900 dark:text-gray-100 font-semibold"
                  : "border-transparent text-gray-400 dark:text-gray-500 font-medium"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Column headers */}
      <div
        className="grid gap-x-3 px-3 pb-2 items-center"
        style={{ gridTemplateColumns: "1fr 110px 84px 44px" }}
      >
        <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {t("markets.col_question")}
        </span>
        <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">
          {t("markets.col_activity")}
        </span>
        <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">
          {t("markets.col_outcome")}
        </span>
        <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">
          {t("markets.col_time")}
        </span>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <p className="text-[13px] text-gray-400 dark:text-gray-500 py-6 text-center">
          {t("markets.loading")}
        </p>
      )}
      {isError && (
        <p className="text-[13px] text-red-500 dark:text-red-400 py-6 text-center">
          {t("markets.load_error")}
        </p>
      )}

      {/* Market rows card */}
      {!isLoading && (
        <div className="bg-white dark:bg-[oklch(18%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(22%_0.015_250)] rounded-[10px] overflow-hidden">
          {allMarkets.map((market, i) => (
            <MarketRow
              key={market.id}
              market={market}
              isLast={i === allMarkets.length - 1}
            />
          ))}
          {allMarkets.length === 0 && (
            <div className="py-10 text-center text-[13px] text-gray-400 dark:text-gray-500">
              {t("markets.no_match")}
            </div>
          )}
        </div>
      )}

      {/* Infinite scroll sentinel + loading indicator */}
      <div ref={sentinelRef} className="h-1" />
      {isFetchingNextPage && (
        <p className="text-[13px] text-gray-400 dark:text-gray-500 py-4 text-center">
          {t("markets.loading")}
        </p>
      )}
    </div>
  );
}
