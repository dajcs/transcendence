"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useT } from "@/i18n";

interface TransactionEntry {
  id: string;
  date: string;
  type: string;
  description: string;
  market_id: string | null;
  market_title: string | null;
  bp_delta: number;
  tp_delta: number;
}
interface TransactionListResponse {
  transactions: TransactionEntry[];
  total: number;
}

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  kp: number;
  tp: number;
  total_bets: number;
  win_rate: number;
  is_friend: boolean;
  friendship_status: string | null;
}

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const isOwnProfile = currentUser?.username === params.username;
  const t = useT();

  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [txOffset, setTxOffset] = useState(0);
  const [sortBy, setSortBy] = useState<"date" | "bp" | "tp" | "type">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [allTx, setAllTx] = useState<TransactionEntry[]>([]);

  const profileQuery = useQuery<Profile>({
    queryKey: ["profile", params.username],
    queryFn: async () => {
      const { data } = await api.get(`/api/users/${encodeURIComponent(params.username)}`);
      return data;
    },
  });

  const profile = profileQuery.data;

  const transactionsQuery = useQuery<TransactionListResponse>({
    queryKey: ["user-transactions", params.username, txOffset, sortBy, sortDir],
    queryFn: async () =>
      (await api.get(
        `/api/users/${encodeURIComponent(params.username)}/transactions?offset=${txOffset}&limit=25&sort_by=${sortBy}&sort_dir=${sortDir}`
      )).data,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (transactionsQuery.data?.transactions) {
      setAllTx((prev) =>
        txOffset === 0
          ? transactionsQuery.data!.transactions
          : [...prev, ...transactionsQuery.data!.transactions]
      );
    }
  }, [transactionsQuery.data, txOffset]);

  const handleSort = (field: "date" | "bp" | "tp" | "type") => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setTxOffset(0);
    setAllTx([]);
  };

  const sortIcon = (field: string) =>
    sortBy === field ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const TYPE_COLORS: Record<string, string> = {
    bet_placed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    bet_won: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    bet_lost: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    withdrawal: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    daily_bonus: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    kp_allocation: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    payout: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };

  useEffect(() => {
    if (profile && !editing) {
      setBio(profile.bio || "");
    }
  }, [profile?.bio, editing]);

  const updateProfile = useMutation({
    mutationFn: async (data: { bio?: string }) => api.put("/api/users/me", data),
    onSuccess: async () => {
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["profile", params.username] });
    },
  });

  const sendFriendRequest = useMutation({
    mutationFn: async (userId: string) => api.post(`/api/friends/request/${userId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile", params.username] });
    },
  });

  return (
    <div className="space-y-6">
      {profileQuery.isLoading && <p className="text-sm text-gray-500 dark:text-gray-400">{t("profile.loading")}</p>}
      {profileQuery.isError && <p className="text-sm text-red-600">{t("profile.not_found")}</p>}

      {profile && (
        <>
          {/* Profile header */}
          <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="h-20 w-20 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-2xl font-bold text-gray-700 dark:text-gray-300">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  profile.username[0].toUpperCase()
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-bold">{profile.username}</h1>
                  {isOwnProfile && (
                    <Link
                      href="/settings"
                      title={t("profile.settings")}
                      className="rounded border border-gray-200 dark:border-gray-700 p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                      aria-label="Settings"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </Link>
                  )}
                  {!isOwnProfile && (
                    <div className="flex gap-2">
                      {profile.friendship_status === "accepted" && (
                        <span className="rounded bg-green-100 dark:bg-green-900/20 px-3 py-1 text-sm text-green-700 dark:text-green-400">
                          {t("profile.friends")}
                        </span>
                      )}
                      {profile.friendship_status === "pending" && (
                        <span className="rounded bg-yellow-100 dark:bg-yellow-900/20 px-3 py-1 text-sm text-yellow-700 dark:text-yellow-400">
                          {t("profile.request_pending")}
                        </span>
                      )}
                      {!profile.friendship_status && (
                        <button
                          onClick={() => sendFriendRequest.mutate(profile.id)}
                          disabled={sendFriendRequest.isPending}
                          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {t("profile.add_friend")}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t("profile.joined")} {new Date(profile.created_at).toLocaleDateString()}
                </p>

                {/* Bio */}
                {editing ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={500}
                      rows={3}
                      className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder={t("profile.bio_placeholder")}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateProfile.mutate({ bio })}
                        disabled={updateProfile.isPending}
                        className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                      >
                        {t("common.save")}
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setBio(profile.bio || "");
                        }}
                        className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm text-gray-700 dark:text-gray-300"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {profile.bio || (isOwnProfile ? t("profile.no_bio") : "")}
                    </p>
                    {isOwnProfile && (
                      <button
                        onClick={() => setEditing(true)}
                        className="mt-1 text-xs text-blue-600 hover:underline"
                      >
                        {profile.bio ? t("profile.edit_bio") : t("profile.add_bio")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{profile.kp}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("profile.karma_points")}</p>
            </div>
            <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{profile.tp}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("profile.truth_points")}</p>
            </div>
            <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{profile.total_bets}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("profile.total_bets")}</p>
            </div>
            <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{profile.win_rate}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("profile.win_rate")}</p>
            </div>
          </div>

          {sendFriendRequest.isError && (
            <p className="text-sm text-red-600">{t("profile.friend_error")}</p>
          )}

          {/* Point Transaction Ledger — D-04, D-05, D-06, D-07 */}
          <section className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
            <h2 className="text-lg font-semibold">{t("profile.transaction_ledger")}</h2>
            {transactionsQuery.isLoading && txOffset === 0 ? (
              <div className="space-y-2 animate-pulse">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-8 rounded bg-gray-200 dark:bg-gray-700" />
                ))}
              </div>
            ) : transactionsQuery.isError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{t("ledger.error")}</p>
            ) : allTx.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("ledger.no_transactions")}</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                        <th
                          className="pb-2 text-left cursor-pointer select-none"
                          onClick={() => handleSort("date")}
                        >
                          {t("ledger.date")}{sortIcon("date")}
                        </th>
                        <th
                          className="pb-2 text-left cursor-pointer select-none"
                          onClick={() => handleSort("type")}
                        >
                          {t("ledger.type")}{sortIcon("type")}
                        </th>
                        <th className="pb-2 text-left">{t("ledger.description")}</th>
                        <th
                          className="pb-2 text-right cursor-pointer select-none"
                          onClick={() => handleSort("bp")}
                        >
                          {t("ledger.bp_delta")}{sortIcon("bp")}
                        </th>
                        <th className="pb-2 text-right">{t("ledger.tp_delta")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {allTx.map((tx) => (
                        <tr key={tx.id}>
                          <td className="py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {new Date(tx.date).toLocaleString()}
                          </td>
                          <td className="py-2">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${TYPE_COLORS[tx.type] ?? TYPE_COLORS.daily_bonus}`}>
                              {t(`ledger.type_${tx.type}` as Parameters<typeof t>[0]) || tx.type}
                            </span>
                          </td>
                          <td className="py-2 text-gray-700 dark:text-gray-300">
                            {tx.market_title && tx.market_id ? (
                              <a href={`/markets/${tx.market_id}`} className="hover:underline text-blue-600 dark:text-blue-400">
                                {tx.market_title}
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className={`py-2 text-right font-medium ${tx.bp_delta > 0 ? "text-green-600 dark:text-green-400" : tx.bp_delta < 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"}`}>
                            {tx.bp_delta > 0 ? `+${tx.bp_delta}` : tx.bp_delta !== 0 ? String(tx.bp_delta) : "—"}
                          </td>
                          <td className={`py-2 text-right font-medium ${tx.tp_delta > 0 ? "text-blue-600 dark:text-blue-400" : tx.tp_delta !== 0 ? "text-gray-500" : "text-gray-400"}`}>
                            {tx.tp_delta !== 0 ? (tx.tp_delta > 0 ? `+${tx.tp_delta}` : String(tx.tp_delta)) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {transactionsQuery.data && allTx.length < transactionsQuery.data.total && (
                  <button
                    onClick={() => setTxOffset((o) => o + 25)}
                    className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {transactionsQuery.isFetching ? t("common.loading") : t("ledger.load_more")}
                  </button>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
