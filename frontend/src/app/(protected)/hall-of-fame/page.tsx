"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useT } from "@/i18n";

type HallTab = "bp" | "tp";

interface BaseHallOfFameEntry {
  id: string;
  username: string;
  avatar_url: string | null;
  markets_count: number;
}

interface HallOfFameEntry extends BaseHallOfFameEntry {
  banked_bp: number;
}

interface HallOfFameTpEntry extends BaseHallOfFameEntry {
  truth_points: number;
}

interface HallOfFameResponse {
  entries: HallOfFameEntry[];
  tp_entries: HallOfFameTpEntry[];
  total: number;
}

export default function HallOfFamePage() {
  const t = useT();
  const [activeTab, setActiveTab] = useState<HallTab>("bp");

  const hallQuery = useQuery<HallOfFameResponse>({
    queryKey: ["hall-of-fame"],
    queryFn: async () => (await api.get("/api/users/hall-of-fame")).data,
    staleTime: 60_000,
  });

  const bpEntries = hallQuery.data?.entries ?? [];
  const tpEntries = hallQuery.data?.tp_entries ?? [];
  const activeEntries = activeTab === "bp" ? bpEntries : tpEntries;
  const activeMetricLabel = activeTab === "bp" ? t("hall.banked_bp") : t("hall.truth_points");
  const activeEmpty = activeTab === "bp" ? t("hall.empty_bp") : t("hall.empty_tp");

  function metricValue(entry: HallOfFameEntry | HallOfFameTpEntry) {
    return activeTab === "bp"
      ? (entry as HallOfFameEntry).banked_bp.toFixed(2)
      : (entry as HallOfFameTpEntry).truth_points.toFixed(2);
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-5 dark:border-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("hall.title")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-400">{t("hall.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800" role="tablist">
        {(["bp", "tp"] as const).map((tab) => {
          const selected = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
                selected
                  ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
                  : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              }`}
            >
              {tab === "bp" ? t("hall.tab_bp") : t("hall.tab_tp")}
            </button>
          );
        })}
      </div>

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {activeTab === "bp" ? t("hall.bp_heading") : t("hall.tp_heading")}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {activeTab === "bp" ? t("hall.bp_subtitle") : t("hall.tp_subtitle")}
            </p>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {activeEntries.length} {t("hall.entries")}
          </p>
        </div>

        {hallQuery.isLoading ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("common.loading")}</p>
        ) : hallQuery.isError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{t("ledger.error")}</p>
        ) : !activeEntries.length ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">{activeEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-gray-800 dark:text-gray-400">
                  <th className="px-3 py-2">{t("hall.rank")}</th>
                  <th className="px-3 py-2">{t("hall.user")}</th>
                  <th className="px-3 py-2 text-right">{activeMetricLabel}</th>
                  <th className="px-3 py-2 text-right">{t("hall.markets")}</th>
                </tr>
              </thead>
              <tbody>
                {activeEntries.map((entry, index) => (
                  <tr
                    key={entry.id}
                    className="border-b border-gray-100 last:border-b-0 dark:border-gray-900"
                  >
                    <td className="px-3 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      #{index + 1}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/profile/${encodeURIComponent(entry.username)}`}
                        className="flex items-center gap-3 hover:underline"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-900 dark:bg-blue-950 dark:text-blue-100">
                          {entry.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={entry.avatar_url} alt={entry.username} className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            entry.username.slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{entry.username}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-blue-700 dark:text-blue-300">
                      {metricValue(entry)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {entry.markets_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
