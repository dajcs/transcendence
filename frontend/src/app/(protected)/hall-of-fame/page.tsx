"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import Avatar from "@/components/Avatar";
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
    <div>
      {/* Tab filter row */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {(["bp", "tp"] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`text-[12px] px-2.5 py-[5px] rounded-md cursor-pointer whitespace-nowrap border transition-colors ${
                isActive
                  ? "bg-[oklch(91%_0.006_250)] dark:bg-[oklch(24%_0.015_250)] border-[oklch(88%_0.005_250)] dark:border-[oklch(28%_0.015_250)] text-gray-900 dark:text-gray-100 font-semibold"
                  : "border-transparent text-gray-400 dark:text-gray-500 font-medium"
              }`}
            >
              {tab === "bp" ? t("hall.tab_bp") : t("hall.tab_tp")}
            </button>
          );
        })}
        {!hallQuery.isLoading && (
          <span className="ml-auto text-[12px] text-gray-400 dark:text-gray-500">
            {activeEntries.length} {t("hall.entries")}
          </span>
        )}
      </div>

      {/* Content card */}
      <div className="bg-white dark:bg-[oklch(18%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(22%_0.015_250)] rounded-[10px] overflow-hidden">
        {hallQuery.isLoading ? (
          <p className="text-[13px] text-gray-400 dark:text-gray-500 py-6 text-center">{t("common.loading")}</p>
        ) : hallQuery.isError ? (
          <p className="text-[13px] text-red-500 dark:text-red-400 py-6 text-center">{t("ledger.error")}</p>
        ) : !activeEntries.length ? (
          <p className="text-[13px] text-gray-400 dark:text-gray-500 py-6 text-center">{activeEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-[oklch(22%_0.015_250)]">
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("hall.rank")}</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("hall.user")}</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{activeMetricLabel}</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("hall.markets")}</th>
                </tr>
              </thead>
              <tbody>
                {activeEntries.map((entry, index) => (
                  <tr
                    key={entry.id}
                    className="border-b border-gray-100 dark:border-[oklch(22%_0.015_250)] last:border-b-0 hover:bg-[oklch(97%_0.008_264)] dark:hover:bg-[oklch(20%_0.015_250)] transition-colors duration-100"
                  >
                    <td className="px-3 py-2.5 text-[13px] font-semibold text-gray-500 dark:text-gray-400">
                      #{index + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/profile/${encodeURIComponent(entry.username)}`}
                        className="flex items-center gap-2.5"
                      >
                        <Avatar username={entry.username} avatarUrl={entry.avatar_url} />
                        <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100 hover:text-[var(--accent)] transition-colors">
                          {entry.username}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] font-semibold tabular-nums text-[var(--accent)]">
                      {metricValue(entry)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-gray-500 dark:text-gray-400">
                      {entry.markets_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
