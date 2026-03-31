"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { BetPositionsListResponse, Market, MarketListResponse } from "@/lib/types";
import { useAuthStore } from "@/store/auth";

type Tab = "my_bets" | "my_markets";

const CLOSED_STATUSES = new Set(["closed"]);

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>("my_bets");

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
    { id: "my_bets", label: "My Bets" },
    { id: "my_markets", label: "My Markets" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      {user && (
        <div className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-700">
          <p>
            Welcome, <span className="font-medium">{user.username}</span>
          </p>
          <p className="mt-1">BP: {user.bp} · KP: {user.kp} · TP: {user.tp}</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
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
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Active</h2>
            {positionsQuery.data?.active.length ? (
              <div className="space-y-2">
                {positionsQuery.data.active.map((position) => (
                  <Link
                    key={position.id}
                    href={`/markets/${position.bet_id}`}
                    className="block rounded border border-gray-200 bg-white p-3 hover:border-gray-300"
                  >
                    <p className="font-medium text-gray-900">{position.market_title}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {position.side.toUpperCase()} · {position.bp_staked} BP staked ·{" "}
                      Win {position.side === "yes" ? position.yes_pct : position.no_pct}%
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No active bets.</p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Resolved / Withdrawn</h2>
            {positionsQuery.data?.resolved.length ? (
              <div className="space-y-2">
                {positionsQuery.data.resolved.map((position) => (
                  <Link
                    key={position.id}
                    href={`/markets/${position.bet_id}`}
                    className="block rounded border border-gray-200 bg-white p-3 text-sm text-gray-700 hover:border-gray-300"
                  >
                    <p className="font-medium text-gray-900">{position.market_title}</p>
                    <p className="mt-1">
                      {position.side.toUpperCase()} · Stake {position.bp_staked} BP · Refund{" "}
                      {position.refund_bp ?? 0} BP
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No resolved positions yet.</p>
            )}
          </section>
        </div>
      )}

      {/* My Markets */}
      {tab === "my_markets" && (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Active</h2>
            {activeMarkets.length ? (
              <div className="space-y-2">
                {activeMarkets.map((market) => (
                  <Link
                    key={market.id}
                    href={`/markets/${market.id}`}
                    className="block rounded border border-gray-200 bg-white p-3 hover:border-gray-300"
                  >
                    <p className="font-medium text-gray-900">{market.title}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {market.status.replace(/_/g, " ")} · deadline{" "}
                      {new Date(market.deadline).toLocaleDateString()}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No active markets.{" "}
                <Link href="/markets/new" className="text-blue-600 hover:underline">
                  Create one
                </Link>
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Resolved / Withdrawn</h2>
            {closedMarkets.length ? (
              <div className="space-y-2">
                {closedMarkets.map((market) => (
                  <Link
                    key={market.id}
                    href={`/markets/${market.id}`}
                    className="block rounded border border-gray-200 bg-white p-3 text-sm text-gray-700 hover:border-gray-300"
                  >
                    <p className="font-medium text-gray-900">{market.title}</p>
                    <p className="mt-1 text-gray-600">
                      {market.status.replace(/_/g, " ")} · deadline{" "}
                      {new Date(market.deadline).toLocaleDateString()}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No closed markets yet.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
