"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useSocketStore } from "@/store/socket";
import { useT } from "@/i18n";
import { getMarketPath } from "@/lib/markets";
import type { BetPositionsListResponse, MarketListResponse } from "@/lib/types";

interface TransactionEntry {
  id: string;
  date: string;
  type: string;
  description: string;
  market_id: string | null;
  market_title: string | null;
  bp_delta: number;
  bp_balance: number;
  tp_delta: number;
  tp_balance: number;
}
interface TransactionListResponse {
  transactions: TransactionEntry[];
  total: number;
}

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  mission: string | null;
  created_at: string;
  lp: number;
  bp: number;
  tp: number;
  total_bets: number;
  win_rate: number;
  is_friend: boolean;
  friendship_status: string | null;
}

type Tab = "points" | "bets" | "markets";

const STATUS_COLORS: Record<string, string> = {
  open: "text-gray-700 dark:text-gray-300",
  pending_resolution: "text-yellow-700 dark:text-yellow-400",
  proposer_resolved: "text-blue-700 dark:text-blue-400",
  disputed: "text-violet-700 dark:text-violet-400",
  closed: "text-green-700 dark:text-green-400",
};

const TYPE_COLORS: Record<string, string> = {
  market: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  bet_placed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  bet_refund: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  bet_won: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  bet_lost: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  withdrawal: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  daily_bonus: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  lp_allocation: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  dispute: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  payout: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const AVATAR_HUES = [40, 145, 160, 205, 264, 270, 310, 25, 320, 180];

function avatarColor(username: string): string {
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return `oklch(56% 0.2 ${AVATAR_HUES[hash % AVATAR_HUES.length]})`;
}

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const { user: currentUser, setAvatarUrl } = useAuthStore();
  const queryClient = useQueryClient();
  const socket = useSocketStore((s) => s.socket);
  const isOwnProfile = currentUser?.username === params.username;
  const t = useT();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>("points");
  const [editing, setEditing] = useState(false);
  const [mission, setBio] = useState("");
  const [txOffset, setTxOffset] = useState(0);
  const [sortBy, setSortBy] = useState<"date" | "bp" | "tp" | "type">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [allTx, setAllTx] = useState<TransactionEntry[]>([]);

  const profileQuery = useQuery<Profile>({
    queryKey: ["profile", params.username],
    queryFn: async () => (await api.get(`/api/users/${encodeURIComponent(params.username)}`)).data,
  });

  const profile = profileQuery.data;

  useEffect(() => {
    if (!socket || !profile?.id) return;

    const handler = (payload: { user_id: string; bp: number; lp: number; tp: number }) => {
      if (payload.user_id !== profile.id) return;
      queryClient.setQueryData<Profile>(["profile", params.username], (current) =>
        current
          ? {
              ...current,
              bp: payload.bp,
              lp: payload.lp,
              tp: payload.tp,
            }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["profile", params.username] });
      if (activeTab === "points") {
        setTxOffset(0);
        void queryClient.invalidateQueries({ queryKey: ["user-transactions", params.username] });
      }
    };

    socket.on("points:balance_changed", handler);
    return () => {
      socket.off("points:balance_changed", handler);
    };
  }, [socket, profile?.id, params.username, queryClient, activeTab]);

  const transactionsQuery = useQuery<TransactionListResponse>({
    queryKey: ["user-transactions", params.username, txOffset, sortBy, sortDir],
    queryFn: async () =>
      (await api.get(
        `/api/users/${encodeURIComponent(params.username)}/transactions?offset=${txOffset}&limit=25&sort_by=${sortBy}&sort_dir=${sortDir}`
      )).data,
    staleTime: 30_000,
    enabled: activeTab === "points",
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

  const positionsQuery = useQuery<BetPositionsListResponse>({
    queryKey: ["profile-positions", profile?.id],
    queryFn: async () => (await api.get(`/api/bets/positions?user_id=${profile!.id}`)).data,
    enabled: activeTab === "bets" && !!profile?.id,
    staleTime: 30_000,
  });

  const myMarketsQuery = useQuery<MarketListResponse>({
    queryKey: ["profile-markets", profile?.id],
    queryFn: async () =>
      (await api.get(`/api/markets?proposer_id=${profile!.id}&limit=50&sort=newest`)).data,
    enabled: activeTab === "markets" && !!profile?.id,
    staleTime: 30_000,
  });

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

  const shortStatus = (s: string) => {
    if (s === "pending_resolution") return "pending";
    if (s === "proposer_resolved") return "resolved";
    return s.replace(/_/g, " ");
  };

  const fmt = (n: number) => {
    if (n === 0) return "—";
    return (n > 0 ? "+" : "") + n.toFixed(1);
  };
  const trimmedBio = mission.trim();
  const savedBio = profile?.mission ?? "";
  const canAcceptMission = isOwnProfile && trimmedBio.length > 0 && trimmedBio !== savedBio;

  useEffect(() => {
    if (profile && !editing) setBio(profile.mission || "");
  }, [profile?.mission, editing]);

  const updateProfile = useMutation({
    mutationFn: async (data: { mission?: string }) => api.put("/api/users/me", data),
    onSuccess: async (_result, data) => {
      queryClient.setQueryData<Profile>(["profile", params.username], (current) =>
        current ? { ...current, mission: data.mission ?? current.mission } : current
      );
      setEditing(false);
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post<Profile>("/api/users/me/avatar", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: ({ data }) => {
      queryClient.setQueryData<Profile>(["profile", params.username], data);
      if (data.avatar_url) setAvatarUrl(data.avatar_url);
      void queryClient.invalidateQueries({ queryKey: ["markets"] });
      void queryClient.invalidateQueries({ queryKey: ["hall-of-fame"] });
    },
  });

  const handleAvatarFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    uploadAvatar.mutate(file);
  };

  const sendFriendRequest = useMutation({
    mutationFn: async (userId: string) => api.post(`/api/friends/request/${userId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile", params.username] });
    },
  });

  const tabClass = (tab: Tab) =>
    `text-[12px] px-2.5 py-[5px] rounded-md cursor-pointer whitespace-nowrap border transition-colors ${
      activeTab === tab
        ? "bg-[oklch(91%_0.006_250)] dark:bg-[oklch(24%_0.015_250)] border-[oklch(88%_0.005_250)] dark:border-[oklch(28%_0.015_250)] text-gray-900 dark:text-gray-100 font-semibold"
        : "border-transparent text-gray-400 dark:text-gray-500 font-medium"
    }`;

  return (
    <div className="space-y-3">
      {profileQuery.isLoading && <p className="text-[13px] text-gray-400 dark:text-gray-500">{t("profile.loading")}</p>}
      {profileQuery.isError && <p className="text-[13px] text-red-500 dark:text-red-400">{t("profile.not_found")}</p>}

      {profile && (
        <>
          {/* Profile header */}
          <div className="bg-white dark:bg-[oklch(18%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(22%_0.015_250)] rounded-[10px] p-4">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                {isOwnProfile && (
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    onChange={handleAvatarFile}
                    className="hidden"
                    data-testid="avatar-upload-input"
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (isOwnProfile && !uploadAvatar.isPending) avatarInputRef.current?.click();
                  }}
                  disabled={!isOwnProfile || uploadAvatar.isPending}
                  title={isOwnProfile ? "Upload custom avatar image" : undefined}
                  aria-label={isOwnProfile ? "Upload custom avatar image" : profile.username}
                  style={{ background: profile.avatar_url ? undefined : avatarColor(profile.username) }}
                  className={`h-16 w-16 rounded-full flex items-center justify-center text-white font-bold text-xl overflow-hidden transition ${
                    isOwnProfile
                      ? "cursor-pointer ring-offset-2 ring-offset-white hover:ring-2 hover:ring-[var(--accent)] dark:ring-offset-[oklch(18%_0.015_250)]"
                      : "cursor-default"
                  }`}
                >
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt={profile.username} className="h-full w-full object-cover" />
                  ) : (
                    profile.username[0].toUpperCase()
                  )}
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h1 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">{profile.username}</h1>
                  {isOwnProfile && (
                    <Link
                      href="/settings"
                      title={t("profile.settings")}
                      className="text-[12px] px-2.5 py-[5px] rounded-md border border-[oklch(88%_0.005_250)] dark:border-[oklch(28%_0.015_250)] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    >
                      {t("profile.settings")}
                    </Link>
                  )}
                  {!isOwnProfile && (
                    <div className="flex gap-2">
                      {profile.friendship_status === "accepted" && (
                        <span className="text-[12px] px-2.5 py-[5px] rounded-md bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">{t("profile.friends")}</span>
                      )}
                      {profile.friendship_status === "pending" && (
                        <span className="text-[12px] px-2.5 py-[5px] rounded-md bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400">{t("profile.request_pending")}</span>
                      )}
                      {!profile.friendship_status && (
                        <button
                          onClick={() => sendFriendRequest.mutate(profile.id)}
                          disabled={sendFriendRequest.isPending}
                          className="text-[12px] px-2.5 py-[5px] rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                        >
                          {t("profile.add_friend")}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <p className="mt-1 text-[12px] text-gray-400 dark:text-gray-500">
                  {t("profile.joined")} {new Date(profile.created_at).toLocaleDateString()}
                </p>

                <div className="mt-2">
                  {isOwnProfile && (!profile.mission || editing) ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        value={mission}
                        onChange={(e) => setBio(e.target.value)}
                        maxLength={500}
                        className="flex-1 px-3 py-1.5 rounded-md text-[13px] bg-[oklch(97%_0.005_250)] dark:bg-[oklch(20%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(24%_0.015_250)] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors sm:max-w-md"
                        placeholder={t("profile.add_mission")}
                      />
                      {canAcceptMission && (
                        <button
                          onClick={() => updateProfile.mutate({ mission: trimmedBio })}
                          disabled={updateProfile.isPending}
                          className="w-fit text-[12px] px-2.5 py-[5px] rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                        >
                          {t("profile.accept_mission")}
                        </button>
                      )}
                    </div>
                  ) : isOwnProfile ? (
                    <button
                      onClick={() => setEditing(true)}
                      title={t("profile.change_mission")}
                      className="text-left text-[13px] text-gray-700 dark:text-gray-300 hover:text-[var(--accent)] transition-colors"
                    >
                      {profile.mission}
                    </button>
                  ) : !profile.mission ? (
                    <p className="text-[13px] text-gray-400 dark:text-gray-500">{t("profile.no_blurb")}</p>
                  ) : (
                    <p className="text-[13px] text-gray-700 dark:text-gray-300">{profile.mission}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { value: profile.lp, label: "❤️" },
              { value: profile.bp.toFixed(1), label: "BP" },
              { value: profile.tp.toFixed(1), label: "TP" },
              { value: profile.total_bets, label: t("profile.total_bets") },
              { value: `${profile.win_rate.toFixed(1)}%`, label: t("profile.win_rate") },
            ].map(({ value, label }) => (
              <div key={label} className="bg-white dark:bg-[oklch(18%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(22%_0.015_250)] rounded-[8px] p-1.5 sm:p-3 text-center">
                <p className="text-[12px] sm:text-[18px] font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">{value}</p>
                <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {sendFriendRequest.isError && <p className="text-[13px] text-red-500 dark:text-red-400">{t("profile.friend_error")}</p>}
          {uploadAvatar.isError && <p className="text-[13px] text-red-500 dark:text-red-400">Avatar upload failed.</p>}

          {/* Tab filter row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["points", "bets", "markets"] as Tab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={tabClass(tab)}
              >
                {tab === "points"
                  ? (isOwnProfile ? t("profile.tab_points_own") : t("profile.tab_points", { username: profile.username }))
                  : tab === "bets"
                  ? (isOwnProfile ? t("profile.tab_bets_own") : t("profile.tab_bets", { username: profile.username }))
                  : (isOwnProfile ? t("profile.tab_markets_own") : t("profile.tab_markets", { username: profile.username }))}
              </button>
            ))}
          </div>

          {/* Tab content card */}
          <div className="bg-white dark:bg-[oklch(18%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(22%_0.015_250)] rounded-[10px] overflow-hidden">
            <div className="p-4">
              {/* Points tab */}
              {activeTab === "points" && (
                <div className="space-y-3">
                  {transactionsQuery.isLoading && txOffset === 0 ? (
                    <div className="space-y-2 animate-pulse">
                      {[0, 1, 2].map((i) => <div key={i} className="h-7 rounded-md bg-gray-100 dark:bg-[oklch(22%_0.015_250)]" />)}
                    </div>
                  ) : transactionsQuery.isError ? (
                    <p className="text-[13px] text-red-500 dark:text-red-400">{t("ledger.error")}</p>
                  ) : allTx.length === 0 ? (
                    <p className="text-[13px] text-gray-400 dark:text-gray-500">{t("ledger.no_transactions")}</p>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-100 dark:border-[oklch(22%_0.015_250)]">
                              <th className="pb-2 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300" onClick={() => handleSort("date")}>
                                {t("ledger.date")}{sortIcon("date")}
                              </th>
                              <th className="pb-2 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300" onClick={() => handleSort("type")}>
                                {t("ledger.type")}{sortIcon("type")}
                              </th>
                              <th className="pb-2 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("ledger.description")}</th>
                              <th className="pb-2 text-right text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300" onClick={() => handleSort("bp")}>
                                {t("ledger.bp_delta")}{sortIcon("bp")}
                              </th>
                              <th className="hidden sm:table-cell pb-2 text-right text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("ledger.bp_balance")}</th>
                              <th className="pb-2 text-right text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300" onClick={() => handleSort("tp")}>
                                {t("ledger.tp_delta")}{sortIcon("tp")}
                              </th>
                              <th className="hidden sm:table-cell pb-2 text-right text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("ledger.tp_balance")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-[oklch(22%_0.015_250)]">
                            {allTx.filter((tx) => tx.bp_delta !== 0 || tx.tp_delta !== 0).map((tx) => {
                              const lpDesc = tx.type === "lp_allocation" && tx.bp_delta > 0
                                ? tx.description || `${Math.round(Math.pow(2, tx.bp_delta) - 1)} ❤️`
                                : null;
                              return (
                                <tr key={tx.id} className="hover:bg-[oklch(97%_0.008_264)] dark:hover:bg-[oklch(20%_0.015_250)] transition-colors duration-100">
                                  <td className="py-2 text-[11px] text-gray-400 dark:text-gray-500">
                                    <div>{new Date(tx.date).toLocaleDateString()}</div>
                                    <div className="text-[10px]">{new Date(tx.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                                  </td>
                                  <td className="py-2">
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TYPE_COLORS[tx.type] ?? TYPE_COLORS.daily_bonus}`}>
                                      {t(`ledger.type_${tx.type}` as Parameters<typeof t>[0]) || tx.type}
                                    </span>
                                  </td>
                                  <td className="py-2 text-[13px] text-gray-700 dark:text-gray-300 max-w-[180px] truncate">
                                    {lpDesc ? (
                                      <span className="text-purple-600 dark:text-purple-400">{lpDesc}</span>
                                    ) : tx.market_title && tx.market_id ? (
                                      <Link href={getMarketPath(tx.market_id, tx.market_title)} className="hover:underline text-[var(--accent)]">
                                        {tx.market_title}
                                      </Link>
                                    ) : tx.description ? (
                                      <span>{tx.description}</span>
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </td>
                                  <td className={`py-2 text-right text-[13px] font-medium tabular-nums ${tx.bp_delta > 0 ? "text-green-600 dark:text-green-400" : tx.bp_delta < 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"}`}>
                                    {tx.bp_delta !== 0 ? fmt(tx.bp_delta) : "—"}
                                  </td>
                                  <td className="hidden sm:table-cell py-2 text-right text-[12px] tabular-nums text-gray-400 dark:text-gray-500">
                                    {tx.bp_balance.toFixed(1)}
                                  </td>
                                  <td className={`py-2 text-right text-[13px] font-medium tabular-nums ${tx.tp_delta > 0 ? "text-[var(--accent)]" : tx.tp_delta < 0 ? "text-gray-500" : "text-gray-400"}`}>
                                    {tx.tp_delta !== 0 ? fmt(tx.tp_delta) : "—"}
                                  </td>
                                  <td className="hidden sm:table-cell py-2 text-right text-[12px] tabular-nums text-gray-400 dark:text-gray-500">
                                    {tx.tp_balance.toFixed(1)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {transactionsQuery.data && allTx.length < transactionsQuery.data.total && (
                        <button
                          onClick={() => setTxOffset((o) => o + 25)}
                          className="text-[12px] px-2.5 py-[5px] rounded-md border border-[oklch(88%_0.005_250)] dark:border-[oklch(28%_0.015_250)] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                        >
                          {transactionsQuery.isFetching ? t("common.loading") : t("ledger.load_more")}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Bets tab */}
              {activeTab === "bets" && (
                <div className="space-y-4">
                  {positionsQuery.isLoading ? (
                    <div className="space-y-2 animate-pulse">{[0, 1, 2].map((i) => <div key={i} className="h-7 rounded-md bg-gray-100 dark:bg-[oklch(22%_0.015_250)]" />)}</div>
                  ) : positionsQuery.isError ? (
                    <p className="text-[13px] text-red-500 dark:text-red-400">{t("profile.bets_error")}</p>
                  ) : (
                    <>
                      {(positionsQuery.data?.active?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{t("profile.active_bets")}</p>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-gray-100 dark:border-[oklch(22%_0.015_250)]">
                                  <th className="pb-2 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("profile.market")}</th>
                                  <th className="pb-2 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("profile.side")}</th>
                                  <th className="pb-2 text-right text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("profile.bp_staked")}</th>
                                  <th className="hidden sm:table-cell pb-2 text-right text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("profile.win_prob")}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-[oklch(22%_0.015_250)]">
                                {positionsQuery.data!.active.map((p) => (
                                  <tr key={p.id} className="hover:bg-[oklch(97%_0.008_264)] dark:hover:bg-[oklch(20%_0.015_250)] transition-colors duration-100">
                                    <td className="py-2 max-w-[130px] sm:max-w-[220px] truncate">
                                      <Link href={getMarketPath(p.bet_id, p.market_title)} className="text-[13px] hover:underline text-[var(--accent)]">
                                        {p.market_title}
                                      </Link>
                                    </td>
                                    <td className={`py-2 text-[13px] font-medium whitespace-nowrap ${p.side === "yes" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                      {typeof p.side === "string" ? p.side.toUpperCase() : p.side}
                                    </td>
                                    <td className="py-2 text-right text-[13px] tabular-nums whitespace-nowrap">{p.bp_staked.toFixed(1)} BP</td>
                                    <td className="hidden sm:table-cell py-2 text-right text-[12px] tabular-nums text-gray-400 dark:text-gray-500">
                                      {p.side === "yes" ? p.yes_pct : p.no_pct}%
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      {(positionsQuery.data?.resolved?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{t("profile.resolved_bets")}</p>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-gray-100 dark:border-[oklch(22%_0.015_250)]">
                                  <th className="pb-2 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("profile.market")}</th>
                                  <th className="pb-2 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("profile.side")}</th>
                                  <th className="hidden sm:table-cell pb-2 text-right text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("profile.bp_staked")}</th>
                                  <th className="pb-2 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("profile.status")}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-[oklch(22%_0.015_250)]">
                                {positionsQuery.data!.resolved.map((p) => (
                                  <tr key={p.id} className="hover:bg-[oklch(97%_0.008_264)] dark:hover:bg-[oklch(20%_0.015_250)] transition-colors duration-100">
                                    <td className="py-2 max-w-[130px] sm:max-w-[220px] truncate">
                                      <Link href={getMarketPath(p.bet_id, p.market_title)} className="text-[13px] hover:underline text-[var(--accent)]">
                                        {p.market_title}
                                      </Link>
                                    </td>
                                    <td className={`py-2 text-[13px] font-medium whitespace-nowrap ${p.side === "yes" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                      {typeof p.side === "string" ? p.side.toUpperCase() : p.side}
                                    </td>
                                    <td className="hidden sm:table-cell py-2 text-right text-[13px] tabular-nums">{p.bp_staked.toFixed(1)} BP</td>
                                    <td className={`py-2 text-[12px] font-medium whitespace-nowrap ${STATUS_COLORS[p.market_status] ?? ""}`}>
                                      {shortStatus(p.market_status)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      {(positionsQuery.data?.active?.length ?? 0) === 0 && (positionsQuery.data?.resolved?.length ?? 0) === 0 && (
                        <p className="text-[13px] text-gray-400 dark:text-gray-500">{t("profile.no_bets")}</p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Markets tab */}
              {activeTab === "markets" && (
                <div className="space-y-3">
                  {myMarketsQuery.isLoading ? (
                    <div className="space-y-2 animate-pulse">{[0, 1, 2].map((i) => <div key={i} className="h-7 rounded-md bg-gray-100 dark:bg-[oklch(22%_0.015_250)]" />)}</div>
                  ) : myMarketsQuery.isError ? (
                    <p className="text-[13px] text-red-500 dark:text-red-400">{t("profile.markets_error")}</p>
                  ) : !myMarketsQuery.data?.items.length ? (
                    <p className="text-[13px] text-gray-400 dark:text-gray-500">{t("profile.no_markets")}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-[oklch(22%_0.015_250)]">
                            <th className="pb-2 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("profile.market")}</th>
                            <th className="pb-2 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("profile.status")}</th>
                            <th className="hidden sm:table-cell pb-2 text-right text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("profile.participants")}</th>
                            <th className="pb-2 text-right text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("profile.deadline")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-[oklch(22%_0.015_250)]">
                          {myMarketsQuery.data.items.map((m) => (
                            <tr key={m.id} className="hover:bg-[oklch(97%_0.008_264)] dark:hover:bg-[oklch(20%_0.015_250)] transition-colors duration-100">
                              <td className="py-2 max-w-[120px] sm:max-w-[220px] truncate">
                                <Link href={getMarketPath(m)} className="text-[13px] hover:underline text-[var(--accent)]">
                                  {m.title}
                                </Link>
                              </td>
                              <td className={`py-2 text-[12px] font-medium whitespace-nowrap ${STATUS_COLORS[m.status] ?? ""}`}>
                                {shortStatus(m.status)}
                              </td>
                              <td className="hidden sm:table-cell py-2 text-right text-[12px] tabular-nums text-gray-400 dark:text-gray-500">
                                {m.position_count}
                              </td>
                              <td className="py-2 text-right text-[11px] text-gray-400 dark:text-gray-500">
                                <div>{new Date(m.deadline).toLocaleDateString()}</div>
                                <div className="text-[10px]">{new Date(m.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
