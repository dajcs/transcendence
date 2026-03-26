"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { BetPositionsListResponse } from "@/lib/types";
import { useAuthStore } from "@/store/auth";

export default function DashboardPage() {
  const { user } = useAuthStore();

  const positionsQuery = useQuery<BetPositionsListResponse>({
    queryKey: ["positions"],
    queryFn: async () => (await api.get("/api/bets/positions")).data,
  });

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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Active Bets</h2>
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
        <h2 className="text-lg font-semibold">Recent Resolved / Withdrawn</h2>
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
  );
}
