"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useT } from "@/i18n";

interface HallOfFameEntry {
  id: string;
  username: string;
  avatar_url: string | null;
  banked_bp: number;
  markets_count: number;
}

interface HallOfFameResponse {
  entries: HallOfFameEntry[];
  total: number;
}

export default function HallOfFamePage() {
  const t = useT();

  const hallQuery = useQuery<HallOfFameResponse>({
    queryKey: ["hall-of-fame"],
    queryFn: async () => (await api.get("/api/users/hall-of-fame")).data,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("hall.title")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-400">{t("hall.subtitle")}</p>
      </div>

      <section className="rounded border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        {hallQuery.isLoading ? (
          <p className="text-sm text-amber-900 dark:text-amber-200">{t("common.loading")}</p>
        ) : hallQuery.isError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{t("ledger.error")}</p>
        ) : !hallQuery.data?.entries.length ? (
          <p className="text-sm text-amber-900 dark:text-amber-200">{t("hall.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-amber-200 text-left text-amber-900 dark:border-amber-800 dark:text-amber-200">
                  <th className="px-3 py-2">{t("hall.rank")}</th>
                  <th className="px-3 py-2">{t("hall.user")}</th>
                  <th className="px-3 py-2 text-right">{t("hall.banked_bp")}</th>
                  <th className="px-3 py-2 text-right">{t("hall.markets")}</th>
                </tr>
              </thead>
              <tbody>
                {hallQuery.data.entries.map((entry, index) => (
                  <tr
                    key={entry.id}
                    className="border-b border-amber-100 last:border-b-0 dark:border-amber-900/50"
                  >
                    <td className="px-3 py-3 font-semibold text-amber-900 dark:text-amber-200">
                      #{index + 1}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/profile/${encodeURIComponent(entry.username)}`}
                        className="flex items-center gap-3 hover:underline"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-sm font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
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
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-amber-900 dark:text-amber-100">
                      {entry.banked_bp.toFixed(2)}
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
