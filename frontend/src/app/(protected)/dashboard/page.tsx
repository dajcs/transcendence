"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { BetPositionsListResponse, Market, MarketListResponse } from "@/lib/types";
import { useAuthStore } from "@/store/auth";
import { useT } from "@/i18n";

type Tab = "my_bets" | "my_markets";

function timeLeft(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "closed";
  const totalMins = Math.floor(ms / 60000);
  if (totalMins < 60) return `${totalMins}m`;
  const hours = Math.floor(totalMins / 60);
  if (hours < 24) return `${hours}h ${totalMins % 60}m`;
  return `${Math.ceil(ms / 86400000)}d`;
}

const CLOSED_STATUSES = new Set(["closed"]);

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

export default function DashboardPage() {
  const { user } = useAuthStore();
  const t = useT();
  const [tab, setTab] = useState<Tab>("my_bets");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "my_markets" || t === "my_bets") setTab(t);
  }, []);

  const positionsQuery = useQuery<BetPositionsListResponse>({
    queryKey: ["positions"],
    queryFn: async () => (await api.get("/api/bets/positions")).data,
  });

  const myMarketsQuery = useQuery<MarketListResponse>({
    queryKey: ["markets", "mine"],
    queryFn: async () => (await api.get("/api/markets?my_markets=true&limit=100")).data,
    enabled: tab === "my_markets",
  });

  const activeMarkets = myMarketsQuery.data?.items.filter(
    (m: Market) => !CLOSED_STATUSES.has(m.status)
  ) ?? [];
  const closedMarkets = myMarketsQuery.data?.items.filter(
    (m: Market) => CLOSED_STATUSES.has(m.status)
  ) ?? [];

  const tabs: { id: Tab; label: string }[] = [
    { id: "my_bets", label: t("dashboard.my_bets") },
    { id: "my_markets", label: t("dashboard.my_markets") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
      {user && (
        <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-sm text-gray-700 dark:text-gray-300">
          <p>
            {t("dashboard.welcome")} <span className="font-medium">{user.username}</span>
          </p>
          <p className="mt-1">BP: {user.bp} · KP: {user.kp} · TP: {user.tp}</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* My Bets */}
      {tab === "my_bets" && (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("dashboard.active")}</h2>
            {positionsQuery.data?.active.length ? (
              <div className="space-y-2">
                {positionsQuery.data.active.map((position) => {
                  const badge = marketStatusBadge(position.market_status, false, t);
                  return (
                    <Link
                      key={position.id}
                      href={`/markets/${position.bet_id}`}
                      className={`block rounded border p-3 hover:border-gray-300 dark:hover:border-gray-600 ${marketCardBg(position.market_status)}`}
                    >
                      <p className="font-medium text-gray-900 dark:text-gray-100">{position.market_title}</p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {position.side.toUpperCase()} · {position.bp_staked} BP {t("dashboard.staked")} ·{" "}
                        {t("dashboard.win")} {position.side === "yes" ? position.yes_pct : position.no_pct}%
                      </p>
                      {badge && (
                        <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>
                          {badge.text}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("dashboard.no_active_bets")}</p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("dashboard.resolved_withdrawn")}</h2>
            {positionsQuery.data?.resolved.length ? (
              <div className="space-y-2">
                {positionsQuery.data.resolved.map((position) => (
                  <Link
                    key={position.id}
                    href={`/markets/${position.bet_id}`}
                    className="block rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-sm text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                  >
                    <p className="font-medium text-gray-900 dark:text-gray-100">{position.market_title}</p>
                    <p className="mt-1">
                      {position.side.toUpperCase()} · {t("dashboard.stake")} {position.bp_staked} BP · {t("dashboard.refund")}{" "}
                      {position.refund_bp ?? 0} BP
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("dashboard.no_resolved")}</p>
            )}
          </section>
        </div>
      )}

      {/* My Markets */}
      {tab === "my_markets" && (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("dashboard.active")}</h2>
            {activeMarkets.length ? (
              <div className="space-y-2">
                {activeMarkets.map((market) => {
                  const badge = marketStatusBadge(market.status, true, t);
                  return (
                    <Link
                      key={market.id}
                      href={`/markets/${market.id}`}
                      className={`block rounded border p-3 hover:border-gray-300 dark:hover:border-gray-600 ${marketCardBg(market.status, true)}`}
                    >
                      <p className="font-medium text-gray-900 dark:text-gray-100">{market.title}</p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {t("markets.deadline")} {new Date(market.deadline).toLocaleString()} ·{" "}
                        {timeLeft(market.deadline) === "closed" ? t("dashboard.closed") : `${t("markets.closes_in")} ${timeLeft(market.deadline)}`}
                      </p>
                      {badge && (
                        <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>
                          {badge.text}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("dashboard.no_active_markets")}{" "}
                <Link href="/markets/new" className="text-blue-600 hover:underline">
                  {t("dashboard.create_one")}
                </Link>
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("dashboard.resolved_withdrawn")}</h2>
            {closedMarkets.length ? (
              <div className="space-y-2">
                {closedMarkets.map((market) => (
                  <Link
                    key={market.id}
                    href={`/markets/${market.id}`}
                    className="block rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-sm text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                  >
                    <p className="font-medium text-gray-900 dark:text-gray-100">{market.title}</p>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                      {market.status.replace(/_/g, " ")} · {t("markets.deadline")}{" "}
                      {new Date(market.deadline).toLocaleString()}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("dashboard.no_closed_markets")}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
