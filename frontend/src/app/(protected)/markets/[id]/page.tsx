"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { getMarketIdFromRouteParam } from "@/lib/markets";
import { useAuthStore } from "@/store/auth";
import { useSocketStore } from "@/store/socket";
import type { BetPosition, BetPositionsListResponse, Comment, Market, ResolutionState } from "@/lib/types";
import UserLink from "@/components/UserLink";
import ReactMarkdown from 'react-markdown';
import { useT } from "@/i18n";

interface ParticipantEntry {
  user_id: string;
  username: string;
  side: string;
  bp_staked: number;
  created_at: string;
}
interface ParticipantListResponse {
  participants: ParticipantEntry[];
  aggregate: { total_bp: number; total_participants: number; avg_bp: number; by_side: Record<string, number> };
  total: number;
}
interface PayoutEntry {
  user_id: string;
  username: string;
  bp_won: number;
  tp_won: number;
}
interface PayoutListResponse {
  payouts: PayoutEntry[];
  total: number;
}

const MAX_COMMENT_DEPTH = 7;

function estimateRefund(position: { side: string; bp_staked: number }, market: Market): { rate: number; total: number; reasonKey: string } {
  if (market.market_type === "numeric") {
    const entries = Object.entries(market.choice_counts);
    const totalVotes = entries.reduce((s, [, c]) => s + c, 0);
    const mean = totalVotes > 0
      ? entries.reduce((s, [v, c]) => s + parseFloat(v) * c, 0) / totalVotes
      : parseFloat(position.side);
    const span = (market.numeric_max ?? 1) - (market.numeric_min ?? 0);
    const rate = span > 0 ? Math.max(0, 1 - Math.abs(parseFloat(position.side) - mean) / span) : 1;
    const roundedRate = Math.round(rate * 100) / 100;
    return {
      rate: roundedRate,
      total: Math.round(position.bp_staked * roundedRate * 100) / 100,
      reasonKey: "market.consensus_proximity" as const,
    };
  }
  if (market.market_type === "binary") {
    const rate = position.side === "yes" ? market.yes_pct / 100 : market.no_pct / 100;
    const roundedRate = Math.round(rate * 100) / 100;
    return {
      rate: roundedRate,
      total: Math.round(position.bp_staked * roundedRate * 100) / 100,
      reasonKey: "market.winning_probability" as const,
    };
  }
  // multiple_choice
  const total = market.position_count || 1;
  const count = market.choice_counts[position.side] ?? 0;
  const rate = count / total;
  const roundedRate = Math.round(rate * 100) / 100;
  return {
    rate: roundedRate,
    total: Math.round(position.bp_staked * roundedRate * 100) / 100,
    reasonKey: "market.winning_probability" as const,
  };
}

export default function MarketDetailPage() {
  const params = useParams<{ id: string }>();
  const marketId = getMarketIdFromRouteParam(params.id);
  const queryClient = useQueryClient();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const socket = useSocketStore((s) => s.socket);
  const t = useT();

  const [side, setSide] = useState<string>("yes");
  const [betAmount, setBetAmount] = useState<number>(1);
  const [commentText, setCommentText] = useState("");
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [confirmDisputeOpen, setConfirmDisputeOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [collapsedComments, setCollapsedComments] = useState<Set<string>>(new Set());
  const [resolutionOutcome, setResolutionOutcome] = useState<string>("yes");
  const [resolutionJustification, setResolutionJustification] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [payoutBanner, setPayoutBanner] = useState<string | null>(null);
  const [voteOpinion, setVoteOpinion] = useState<string>("");
  const currentUser = useAuthStore((s) => s.user);

  const [participantOffset, setParticipantOffset] = useState(0);
  const [allParticipants, setAllParticipants] = useState<ParticipantEntry[]>([]);
  const [participantSort, setParticipantSort] = useState<{ key: keyof ParticipantEntry | null; dir: "asc" | "desc" }>({ key: null, dir: "asc" });
  const [payoutSort, setPayoutSort] = useState<{ key: keyof PayoutEntry | null; dir: "asc" | "desc" }>({ key: null, dir: "asc" });

  const refreshParticipants = async () => {
    setParticipantOffset(0);
    await queryClient.invalidateQueries({ queryKey: ["market-positions", marketId] });
  };

  const participantsQuery = useQuery<ParticipantListResponse>({
    queryKey: ["market-positions", marketId, participantOffset],
    queryFn: async () => (await api.get(`/api/markets/${marketId}/positions?offset=${participantOffset}&limit=20`)).data,
    staleTime: 30_000,
    enabled: !!marketId,
  });

  useEffect(() => {
    if (participantsQuery.data?.participants) {
      setAllParticipants((prev) =>
        participantOffset === 0
          ? participantsQuery.data!.participants
          : [...prev, ...participantsQuery.data!.participants]
      );
    }
  }, [participantsQuery.data, participantOffset]);

  const positionsQuery = useQuery<BetPositionsListResponse>({
    queryKey: ["positions"],
    queryFn: async () => (await api.get("/api/bets/positions")).data,
    staleTime: 0,
  });

  const myPosition = [...(positionsQuery.data?.active ?? []), ...(positionsQuery.data?.resolved ?? [])]
    .find((p) => p.bet_id === marketId && p.withdrawn_at === null) ?? null;

  const marketQuery = useQuery<Market>({
    queryKey: ["market", marketId],
    queryFn: async () => (await api.get(`/api/markets/${marketId}`)).data,
  });

  const commentsQuery = useQuery<Comment[]>({
    queryKey: ["comments", marketId],
    queryFn: async () => (await api.get(`/api/markets/${marketId}/comments`)).data,
  });

  const resolutionQuery = useQuery<ResolutionState>({
    queryKey: ["resolution", marketId],
    queryFn: async () => (await api.get(`/api/bets/${marketId}/resolution`)).data,
    enabled: !!marketId && !!marketQuery.data && marketQuery.data.status !== "open",
  });

  const payoutsQuery = useQuery<PayoutListResponse>({
    queryKey: ["market-payouts", marketId],
    queryFn: async () => (await api.get(`/api/markets/${marketId}/payouts`)).data,
    staleTime: 60_000,
    enabled: !!marketId && marketQuery.data?.status === "closed",
  });

  const llmSettingsQuery = useQuery<{ llm_mode: string }>({
    queryKey: ["llm-settings"],
    queryFn: async () => (await api.get("/api/users/me")).data,
  });
  const aiEnabled = llmSettingsQuery.data?.llm_mode !== "disabled";
  const maxBetAmount = currentUser ? Math.min(10, Math.floor(currentUser.bp)) : 0;
  const clampedBetAmount = maxBetAmount > 0 ? Math.min(betAmount, maxBetAmount) : 0;

  useEffect(() => {
    if (maxBetAmount > 0 && betAmount !== clampedBetAmount) {
      setBetAmount(clampedBetAmount);
    }
  }, [betAmount, clampedBetAmount, maxBetAmount]);

  // Join bet room on mount, leave on unmount (D-12)
  useEffect(() => {
    if (!socket || !marketId) return;

    socket.emit("join_bet", { bet_id: marketId });

    // RT-01: Live odds update — patch React Query cache directly
    const onOddsUpdated = (data: { bet_id: string; yes_pct: number; no_pct: number; total_votes: number; choice_counts: Record<string, number>; position_count: number }) => {
      queryClient.setQueryData(["market", marketId], (old: Market | undefined) =>
        old ? { ...old, yes_pct: data.yes_pct, no_pct: data.no_pct, choice_counts: data.choice_counts, position_count: data.position_count } : old
      );
      void refreshParticipants();
    };

    // RT-02: Live comment — invalidate query so comment list refetches
    const onCommentAdded = () => {
      queryClient.invalidateQueries({ queryKey: ["comments", marketId] });
    };

    // RT-03: Bet resolved — show payout banner, refresh state
    const onBetResolved = (data: { bet_id: string; outcome: string; payout_summary: { winners: number; overturned: boolean } }) => {
      queryClient.invalidateQueries({ queryKey: ["market", marketId] });
      queryClient.invalidateQueries({ queryKey: ["resolution", marketId] });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      const msg = data.payout_summary.overturned
        ? t("market.payout_overturned", { outcome: data.outcome.toUpperCase(), winners: data.payout_summary.winners })
        : t("market.payout_resolved", { outcome: data.outcome.toUpperCase(), winners: data.payout_summary.winners });
      setPayoutBanner(msg);
      bootstrap();
    };

    // RT-04: Dispute opened — refresh resolution section
    const onDisputeOpened = () => {
      queryClient.invalidateQueries({ queryKey: ["resolution", marketId] });
      queryClient.invalidateQueries({ queryKey: ["market", marketId] });
    };

    // RT-05: Dispute vote cast — update tallies in cache directly
    const onDisputeVoted = (data: { bet_id: string; vote_weights: Record<string, number> }) => {
      queryClient.setQueryData(
        ["resolution", marketId],
        (old: { resolution: unknown; dispute: { vote_weights: Record<string, number> } | null } | undefined) =>
          old?.dispute
            ? { ...old, dispute: { ...old.dispute, vote_weights: data.vote_weights } }
            : old
      );
    };

    // RT-06: Dispute closed — refresh resolution and market
    const onDisputeClosed = () => {
      queryClient.invalidateQueries({ queryKey: ["resolution", marketId] });
      queryClient.invalidateQueries({ queryKey: ["market", marketId] });
    };

    // RT-07: Status changed (pending_resolution, proposer_resolved, disputed) — refresh market
    const onStatusChanged = (data: { bet_id: string; status: string }) => {
      if (data.bet_id === marketId) {
        queryClient.invalidateQueries({ queryKey: ["market", marketId] });
        queryClient.invalidateQueries({ queryKey: ["resolution", marketId] });
      }
    };

    socket.on("bet:odds_updated", onOddsUpdated);
    socket.on("bet:comment_added", onCommentAdded);
    socket.on("bet:resolved", onBetResolved);
    socket.on("bet:status_changed", onStatusChanged);
    socket.on("dispute:opened", onDisputeOpened);
    socket.on("dispute:voted", onDisputeVoted);
    socket.on("dispute:closed", onDisputeClosed);

    return () => {
      socket.emit("leave_bet", { bet_id: marketId });
      socket.off("bet:odds_updated", onOddsUpdated);
      socket.off("bet:comment_added", onCommentAdded);
      socket.off("bet:resolved", onBetResolved);
      socket.off("bet:status_changed", onStatusChanged);
      socket.off("dispute:opened", onDisputeOpened);
      socket.off("dispute:voted", onDisputeVoted);
      socket.off("dispute:closed", onDisputeClosed);
    };
  }, [socket, marketId, queryClient, bootstrap]);

  const placeBet = useMutation({
    mutationFn: async () => (
      await api.post<BetPosition>("/api/bets", { bet_id: marketId, side, amount: clampedBetAmount })
    ).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["market", marketId] });
      await queryClient.invalidateQueries({ queryKey: ["positions"] });
      await refreshParticipants();
      await bootstrap();
    },
  });

  const postComment = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId: string | null }) =>
      api.post(`/api/markets/${marketId}/comments`, { content, parent_id: parentId }),
    onSuccess: async () => {
      setCommentText("");
      setReplyText("");
      setReplyingTo(null);
      await queryClient.invalidateQueries({ queryKey: ["comments", marketId] });
    },
  });

  const upvoteComment = useMutation({
    mutationFn: async (commentId: string) => api.post(`/api/comments/${commentId}/upvote`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["comments", marketId] });
      await bootstrap();
    },
  });

  const upvoteMarket = useMutation({
    mutationFn: () => api.post(`/api/markets/${marketId}/upvote`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["market", marketId] });
      await bootstrap();
    },
  });

  const unlikeMarket = useMutation({
    mutationFn: () => api.delete(`/api/markets/${marketId}/upvote`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["market", marketId] });
      await bootstrap();
    },
  });

  const unlikeComment = useMutation({
    mutationFn: async (commentId: string) => api.delete(`/api/comments/${commentId}/upvote`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["comments", marketId] });
      await bootstrap();
    },
  });

  const withdrawBet = useMutation({
    mutationFn: (positionId: string) => api.delete(`/api/bets/${positionId}`),
    onSuccess: async () => {
      setShowWithdrawConfirm(false);
      await queryClient.invalidateQueries({ queryKey: ["positions"] });
      await queryClient.invalidateQueries({ queryKey: ["market", marketId] });
      await refreshParticipants();
      await bootstrap();
    },
  });

  const submitResolution = useMutation({
    mutationFn: async () =>
      (await api.post(`/api/bets/${marketId}/resolve`, {
        outcome: resolutionOutcome,
        justification: resolutionJustification,
      })).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["market", marketId] });
      await queryClient.invalidateQueries({ queryKey: ["resolution", marketId] });
    },
  });

  const acceptResolution = useMutation({
    mutationFn: async () => (await api.post(`/api/bets/${marketId}/accept-resolution`)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resolution", marketId] });
    },
  });

  const openDispute = useMutation({
    mutationFn: async () => (await api.post(`/api/bets/${marketId}/dispute`)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["market", marketId] });
      await queryClient.invalidateQueries({ queryKey: ["resolution", marketId] });
      await bootstrap();
    },
  });

  const castVote = useMutation({
    mutationFn: async (vote: string) =>
      (await api.post(`/api/bets/${marketId}/vote`, { vote })).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resolution", marketId] });
    },
  });

  const handleGetHint = async () => {
    if (!evidenceText.trim()) return;
    setHintLoading(true);
    try {
      const resp = await api.post(`/api/bets/${marketId}/resolution-hint`, { evidence: evidenceText });
      setHint(resp.data.hint ?? t("market.no_suggestion"));
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 503) {
        setHint(t("market.ai_budget_exceeded"));
      } else if (status === 429) {
        setHint(t("market.ai_daily_limit"));
      } else {
        setHint(t("market.ai_unavailable"));
      }
    } finally {
      setHintLoading(false);
    }
  };

  const handleGetSummary = async () => {
    setSummaryLoading(true);
    try {
      const resp = await api.post(`/api/bets/${marketId}/summary`);
      setSummary(resp.data.summary ?? t("market.summary_unavailable"));
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { detail?: string } } };
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      if (status === 503) {
        setSummary(t("market.summary_budget_exceeded"));
      } else if (status === 429) {
        setSummary(t("market.summary_daily_limit"));
      } else if (status === 504 || !status) {
        setSummary(t("market.summary_timeout"));
      } else {
        setSummary(detail ?? t("market.summary_unavailable"));
      }
    } finally {
      setSummaryLoading(false);
    }
  };

  const onSubmitComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commentText.trim()) {
      return;
    }
    postComment.mutate({ content: commentText.trim(), parentId: null });
  };

  const market = marketQuery.data;
  const refundEstimate = market && myPosition ? estimateRefund(myPosition, market) : null;
  const deadlinePassed = market ? new Date(market.deadline) < new Date() : false;

  // Seed outcome selector once market type is known
  useEffect(() => {
    if (!market) return;
    if (market.market_type === "binary") setResolutionOutcome("yes");
    else if (market.market_type === "multiple_choice") setResolutionOutcome(market.choices?.[0] ?? "");
    else setResolutionOutcome("");
  }, [market?.market_type]); // eslint-disable-line react-hooks/exhaustive-deps

  const commentItems = commentsQuery.data ?? [];
  // Build depth map, children map, and parent map for tree-ordered rendering
  const commentDepthMap = new Map<string, number>();
  const commentChildrenMap = new Map<string | null, Comment[]>();
  const commentParentMap = new Map<string, string | null>();
  for (const c of commentItems) {
    commentDepthMap.set(c.id, c.parent_id ? (commentDepthMap.get(c.parent_id) ?? 0) + 1 : 0);
    const key = c.parent_id ?? null;
    if (!commentChildrenMap.has(key)) commentChildrenMap.set(key, []);
    commentChildrenMap.get(key)!.push(c);
    commentParentMap.set(c.id, c.parent_id ?? null);
  }

  const isCommentHidden = (comment: Comment): boolean => {
    let parentId = comment.parent_id;
    while (parentId) {
      if (collapsedComments.has(parentId)) return true;
      parentId = commentParentMap.get(parentId) ?? null;
    }
    return false;
  };

  const toggleCollapsed = (id: string) => {
    setCollapsedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const countDescendants = (id: string): number => {
    const children = commentChildrenMap.get(id) ?? [];
    return children.reduce((sum, child) => sum + 1 + countDescendants(child.id), 0);
  };
  // DFS traversal so each reply appears directly under its parent
  const orderedComments: Comment[] = [];
  const dfsComments = (parentId: string | null) => {
    for (const c of commentChildrenMap.get(parentId) ?? []) {
      orderedComments.push(c);
      dfsComments(c.id);
    }
  };
  dfsComments(null);

  useEffect(() => {
    if (!market) return;
    if (market.market_type === "numeric") {
      setSide(String(((market.numeric_min ?? 0) + (market.numeric_max ?? 100)) / 2));
    } else if (market.market_type === "multiple_choice" && market.choices?.length) {
      setSide(market.choices[0]);
    }
    // binary: "yes" default is correct
  }, [market?.market_type]);

  function toggleSort<K extends string>(
    current: { key: K | null; dir: "asc" | "desc" },
    set: (v: { key: K | null; dir: "asc" | "desc" }) => void,
    col: K,
  ) {
    if (current.key !== col) { set({ key: col, dir: "asc" }); return; }
    if (current.dir === "asc") { set({ key: col, dir: "desc" }); return; }
    set({ key: null, dir: "asc" });
  }

  function sortIndicator<K extends string>(sort: { key: K | null; dir: "asc" | "desc" }, col: K) {
    if (sort.key !== col) return <span className="ml-1 text-gray-300 dark:text-gray-600">↕</span>;
    return <span className="ml-1">{sort.dir === "asc" ? "↑" : "↓"}</span>;
  }

  function sortedRows<T>(rows: T[], sort: { key: keyof T | null; dir: "asc" | "desc" }): T[] {
    if (!sort.key) return rows;
    const k = sort.key;
    return [...rows].sort((a, b) => {
      const av = a[k], bv = b[k];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }

  return (
    <div className="space-y-3">
      {marketQuery.isLoading && <p className="text-[13px] text-gray-400 dark:text-gray-500">{t("market.loading")}</p>}
      {marketQuery.isError && <p className="text-[13px] text-red-500 dark:text-red-400">{t("market.load_error")}</p>}

      {market && (
        <>
          <header className="bg-white dark:bg-[oklch(18%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(22%_0.015_250)] rounded-[10px] p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <p className="text-[16px] font-bold text-gray-900 dark:text-gray-100">{market.title}</p>
              <button
                onClick={() => market.user_has_liked ? unlikeMarket.mutate() : upvoteMarket.mutate()}
                disabled={upvoteMarket.isPending || unlikeMarket.isPending}
                className="shrink-0 flex flex-col items-center transition-colors disabled:opacity-50 px-2"
              >
                <span className={`text-xl leading-none ${market.user_has_liked ? "text-red-500" : "text-gray-400 dark:text-gray-500"}`}>
                  {market.user_has_liked ? "❤️" : "♡"}
                </span>
                <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{market.upvote_count}</span>
              </button>
            </div>
            <UserLink
              username={market.proposer_username || "unknown"}
              label={`@${market.proposer_username || "unknown"}`}
              className="block text-[13px] font-medium text-[var(--accent)]"
            />
            <p className="text-[13px] text-gray-600 dark:text-gray-400">{market.description}</p>
            <p className="text-[13px] text-gray-500 dark:text-gray-400">{t("market.resolution_label")} {market.resolution_criteria}</p>
          </header>

          <section className="rounded-[10px] bg-white dark:bg-[oklch(18%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(22%_0.015_250)] p-4">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t("market.live_odds")}</p>
            {market.market_type === "binary" && (
              <>
                <div className="mb-2 h-2 overflow-hidden rounded-full bg-[oklch(91%_0.006_250)] dark:bg-[oklch(22%_0.015_250)]">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${market.yes_pct}%` }} />
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="font-semibold text-green-600 dark:text-green-400">YES {market.yes_pct}% ({market.yes_count})</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">NO {market.no_pct}% ({market.no_count})</span>
                </div>
              </>
            )}
            {market.market_type === "multiple_choice" && (
              <div className="space-y-3">
                {(market.choices ?? []).map((choice) => {
                  const count = market.choice_counts[choice] ?? 0;
                  const pct = market.position_count > 0 ? Math.round((count / market.position_count) * 100) : 0;
                  return (
                    <div key={choice}>
                      <div className="flex justify-between text-[13px] mb-1">
                        <span className="text-gray-700 dark:text-gray-300">{choice}</span>
                        <span className="text-gray-400 dark:text-gray-500">{t("market.votes_count", { count, pct })}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[oklch(91%_0.006_250)] dark:bg-[oklch(22%_0.015_250)]">
                        <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <p className="text-[12px] text-gray-400 dark:text-gray-500 pt-1">{t("market.total_votes_count", { count: market.position_count })}</p>
              </div>
            )}
            {market.market_type === "numeric" && (() => {
              const min = market.numeric_min ?? 0;
              const max = market.numeric_max ?? 100;
              const BINS = 20;
              const binSize = (max - min) / BINS;
              const bins = Array.from({ length: BINS }, (_, i) => ({
                label: `${(min + i * binSize).toFixed(1)}`,
                count: 0,
              }));
              Object.entries(market.choice_counts).forEach(([val, count]) => {
                const v = parseFloat(val);
                const idx = Math.min(Math.floor((v - min) / binSize), BINS - 1);
                if (idx >= 0) bins[idx].count += count;
              });
              const peak = Math.max(...bins.map((b) => b.count), 1);
              const W = 320, H = 60, pad = 4;
              const barW = (W - pad * (BINS + 1)) / BINS;
              return (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {t("market.range_label", { min, max, count: market.position_count })}
                  </p>
                  <svg width={W} height={H + 16} className="overflow-visible">
                    {bins.map((bin, i) => {
                      const barH = Math.round((bin.count / peak) * H);
                      const x = pad + i * (barW + pad);
                      return (
                        <g key={i}>
                          <rect
                            x={x} y={H - barH} width={barW} height={barH}
                            className="fill-purple-500"
                            rx={2}
                          />
                          {bin.count > 0 && (
                            <text x={x + barW / 2} y={H - barH - 3} textAnchor="middle" fontSize={9} className="fill-gray-600 dark:fill-gray-300">
                              {bin.count}
                            </text>
                          )}
                          <text x={x + barW / 2} y={H + 12} textAnchor="middle" fontSize={8} className="fill-gray-400 dark:fill-gray-500">
                            {bin.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              );
            })()}
          </section>

          {/* Participants Section */}
          <section className="rounded-[10px] bg-white dark:bg-[oklch(18%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(22%_0.015_250)] p-4 space-y-3">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t("market.participants")}</p>
            {participantsQuery.isLoading ? (
              <div className="space-y-2 animate-pulse">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-7 rounded-md bg-gray-100 dark:bg-[oklch(22%_0.015_250)]" />
                ))}
              </div>
            ) : participantsQuery.isError ? (
              <p className="text-[13px] text-red-500 dark:text-red-400">{t("market.participants_error")}</p>
            ) : (
              <>
                {participantsQuery.data && (
                  <div className={`grid gap-2 text-center mb-3 ${market?.market_type === "numeric" ? "grid-cols-2" : "grid-cols-3"}`}>
                    <div>
                      <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{participantsQuery.data.aggregate.total_bp} BP</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">{t("market.total_staked")}</p>
                    </div>
                    {market?.market_type !== "numeric" && (
                      <div>
                        <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                          {Object.entries(participantsQuery.data.aggregate.by_side)
                            .map(([side, cnt]) => `${cnt} ${side.toUpperCase()}`)
                            .join(" / ") || "0"}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">{t("market.participants_count")}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{participantsQuery.data.aggregate.avg_bp} BP</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">{t("market.avg_stake")}</p>
                    </div>
                  </div>
                )}
                {allParticipants.length === 0 ? (
                  <p className="text-[13px] text-gray-400 dark:text-gray-500">{t("market.no_participants")}</p>
                ) : (
                  <div className="overflow-auto max-h-64 rounded-[8px] border border-[oklch(91%_0.006_250)] dark:border-[oklch(22%_0.015_250)]">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-white dark:bg-[oklch(18%_0.015_250)] z-10">
                        <tr className="border-b border-gray-100 dark:border-[oklch(22%_0.015_250)]">
                          <th className="pb-2 pt-1 px-2 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300" onClick={() => toggleSort(participantSort, setParticipantSort, "username")}>
                            {t("market.participant_user")}{sortIndicator(participantSort, "username")}
                          </th>
                          <th className="pb-2 pt-1 px-2 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300" onClick={() => toggleSort(participantSort, setParticipantSort, "side")}>
                            {t("market.participant_side")}{sortIndicator(participantSort, "side")}
                          </th>
                          <th className="pb-2 pt-1 px-2 text-right text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300" onClick={() => toggleSort(participantSort, setParticipantSort, "bp_staked")}>
                            {t("market.participant_stake")}{sortIndicator(participantSort, "bp_staked")}
                          </th>
                          <th className="pb-2 pt-1 px-2 text-right text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300" onClick={() => toggleSort(participantSort, setParticipantSort, "created_at")}>
                            {t("market.participant_time")}{sortIndicator(participantSort, "created_at")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-[oklch(22%_0.015_250)]">
                        {sortedRows(allParticipants, participantSort).map((p) => (
                          <tr key={`${p.user_id}-${p.created_at}`} className="hover:bg-[oklch(97%_0.008_264)] dark:hover:bg-[oklch(20%_0.015_250)] transition-colors duration-100">
                            <td className="py-2 px-2 text-[13px]"><UserLink username={p.username} className="text-[var(--accent)]" /></td>
                            <td className={`py-2 px-2 text-[13px] font-medium ${p.side === "yes" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                              {p.side.toUpperCase()}
                            </td>
                            <td className="py-2 px-2 text-right text-[13px] tabular-nums">{p.bp_staked} BP</td>
                            <td className="py-2 px-2 text-right text-[12px] tabular-nums text-gray-400 dark:text-gray-500">
                              {new Date(p.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {participantsQuery.data && allParticipants.length < participantsQuery.data.total && (
                  <button
                    onClick={() => setParticipantOffset((o) => o + 20)}
                    className="text-[12px] text-[var(--accent)] hover:underline"
                  >
                    {participantsQuery.isFetching ? t("common.loading") : t("market.show_more_participants")}
                  </button>
                )}
              </>
            )}
          </section>

          {myPosition && market && (
            <section className="rounded-[10px] border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">{t("market.your_position")}</p>
              <p className="text-[13px] text-blue-800 dark:text-blue-300">
                {market.market_type === "numeric" ? (
                  <>{t("market.estimate_label")} <span className="font-medium">{myPosition.side}</span></>
                ) : market.market_type === "multiple_choice" ? (
                  <>{t("market.choice_label")} <span className="font-medium">{myPosition.side}</span></>
                ) : (
                  <>{t("market.side_label")} <span className="font-medium">{myPosition.side.toUpperCase()}</span></>
                )}
                {" · "}{t("market.staked_label")} <span className="font-medium">{myPosition.bp_staked} BP</span>
              </p>
              {market.status === "open" && (
                <>
                  {!showWithdrawConfirm ? (
                    <button
                      onClick={() => setShowWithdrawConfirm(true)}
                      className="mt-3 text-[12px] px-2.5 py-[5px] rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      {t("market.withdraw")}
                    </button>
                  ) : (
                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                      <p className="text-[13px] text-red-700 dark:text-red-400">
                        {t("market.refund_bp", {
                          stake: myPosition.bp_staked,
                          prob: refundEstimate!.rate,
                          bp: refundEstimate!.total,
                        })}{" "}
                        <span className="text-gray-500 dark:text-gray-400">({t(refundEstimate!.reasonKey as any)})</span>
                      </p>
                      <button
                        onClick={() => withdrawBet.mutate(myPosition.id)}
                        disabled={withdrawBet.isPending}
                        className="text-[12px] px-2.5 py-[5px] rounded-md bg-red-600 text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                      >
                        {withdrawBet.isPending ? t("market.withdrawing") : t("market.withdraw_confirm")}
                      </button>
                      <button
                        onClick={() => setShowWithdrawConfirm(false)}
                        className="text-[13px] text-gray-500 dark:text-gray-400 hover:underline"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  )}
                  {withdrawBet.isError && (
                    <p className="mt-2 text-[13px] text-red-500 dark:text-red-400">{t("market.withdraw_failed")}</p>
                  )}
                </>
              )}
            </section>
          )}

          {/* ResolutionSection: visible when deadline passed or status is in resolution */}
          {(deadlinePassed || market.status !== "open") && (
            <section className="rounded-[10px] border border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 p-4 space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-yellow-700 dark:text-yellow-400">{t("market.resolution")}</p>

              {/* Payout banner */}
              {payoutBanner && (
                <div className="rounded-[8px] bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700 p-3 text-[13px] text-green-800 dark:text-green-300">
                  {payoutBanner}
                </div>
              )}

              {/* Status display */}
              <p className="text-[13px] text-yellow-800 dark:text-yellow-300">
                {t("market.status_label")} <span className="font-medium capitalize">{market.status.replace(/_/g, " ")}</span>
              </p>

              {/* Proposer resolution form: visible to proposer when deadline passed and not yet closed */}
              {(market.status === "pending_resolution" || (deadlinePassed && market.status === "open")) && currentUser?.id === market.proposer_id && (
                <div className="space-y-3 border-t border-yellow-200 dark:border-yellow-700 pt-3">
                  <p className="text-[13px] font-medium text-yellow-900 dark:text-yellow-300">{t("market.submit_resolution")}</p>

                  {/* binary */}
                  {market.market_type === "binary" && (
                    <div className="flex gap-2">
                      {["yes", "no"].map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setResolutionOutcome(opt)}
                          className={`text-[12px] px-2.5 py-[5px] rounded-md transition-colors ${resolutionOutcome === opt ? "bg-green-600 text-white" : "bg-[oklch(91%_0.006_250)] dark:bg-[oklch(24%_0.015_250)] text-gray-700 dark:text-gray-300"}`}
                        >
                          {opt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* multiple choice */}
                  {market.market_type === "multiple_choice" && market.choices && (
                    <div className="flex flex-wrap gap-2">
                      {market.choices.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setResolutionOutcome(opt)}
                          className={`text-[12px] px-2.5 py-[5px] rounded-md transition-colors ${resolutionOutcome === opt ? "bg-green-600 text-white" : "bg-[oklch(91%_0.006_250)] dark:bg-[oklch(24%_0.015_250)] text-gray-700 dark:text-gray-300"}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* numeric range */}
                  {market.market_type === "numeric" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={resolutionOutcome}
                        onChange={(e) => setResolutionOutcome(e.target.value)}
                        min={market.numeric_min ?? undefined}
                        max={market.numeric_max ?? undefined}
                        step="any"
                        placeholder={t("market.enter_value")}
                        className="w-36 px-3 py-1.5 rounded-md text-[13px] bg-[oklch(97%_0.005_250)] dark:bg-[oklch(20%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(24%_0.015_250)] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[var(--accent)] transition-colors"
                      />
                      {(market.numeric_min != null || market.numeric_max != null) && (
                        <span className="text-[12px] text-gray-400 dark:text-gray-500">
                          {t("market.range_bounds", { min: market.numeric_min ?? "−∞", max: market.numeric_max ?? "+∞" })}
                        </span>
                      )}
                    </div>
                  )}
                  <textarea
                    value={resolutionJustification}
                    onChange={(e) => setResolutionJustification(e.target.value)}
                    placeholder={t("market.justification_placeholder")}
                    className="w-full px-3 py-2 rounded-md text-[13px] bg-[oklch(97%_0.005_250)] dark:bg-[oklch(20%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(24%_0.015_250)] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors"
                    rows={3}
                  />

                  {/* AI suggestion inline */}
                  {aiEnabled && (
                    <div className="space-y-2">
                      <textarea
                        value={evidenceText}
                        onChange={(e) => setEvidenceText(e.target.value.slice(0, 500))}
                        placeholder={t("market.evidence_placeholder")}
                        className="w-full px-3 py-2 rounded-md text-[13px] bg-[oklch(97%_0.005_250)] dark:bg-[oklch(20%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(24%_0.015_250)] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors"
                        rows={2}
                      />
                      <button
                        onClick={handleGetHint}
                        disabled={hintLoading || !evidenceText.trim()}
                        className="text-[12px] px-2.5 py-[5px] rounded-md border border-[oklch(88%_0.005_250)] dark:border-[oklch(28%_0.015_250)] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-40 transition-colors"
                      >
                        {hintLoading ? t("market.getting_suggestion") : t("market.get_ai_suggestion")}
                      </button>
                      {hint && (
                        <div className="rounded-[8px] bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 p-3 text-[13px] text-blue-900 dark:text-blue-300">
                          <div className="prose prose-sm max-w-none"><ReactMarkdown>{hint}</ReactMarkdown></div>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => submitResolution.mutate()}
                    disabled={submitResolution.isPending || resolutionJustification.length < 20}
                    className="text-[13px] px-3 py-2 rounded-md bg-yellow-700 text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    {submitResolution.isPending ? t("market.submitting") : t("market.submit_resolution")}
                  </button>
                  {submitResolution.isError && (
                    <p className="text-[13px] text-red-500 dark:text-red-400">
                      {(() => {
                        const d = (submitResolution.error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
                        if (!d) return t("market.failed_submit");
                        if (typeof d === "string") return d;
                        if (Array.isArray(d)) return (d as { msg: string }[]).map((e) => e.msg).join("; ");
                        return t("market.failed_submit");
                      })()}
                    </p>
                  )}
                </div>
              )}

              {/* Show existing resolution */}
              {resolutionQuery.data?.resolution && (
                <div className="border-t border-yellow-200 dark:border-yellow-700 pt-3 text-[13px] text-yellow-800 dark:text-yellow-300 space-y-1">
                  <p>{t("market.outcome_label")} <span className="font-bold uppercase">{resolutionQuery.data.resolution.outcome}</span></p>
                  {resolutionQuery.data.resolution.justification && (
                    <p className="text-[12px] text-yellow-700 dark:text-yellow-400">{resolutionQuery.data.resolution.justification}</p>
                  )}
                  {resolutionQuery.data.resolution.overturned && (
                    <p className="text-[12px] text-red-500 dark:text-red-400 font-medium">{t("market.overturned")}</p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Review window: proposer_resolved — accept/dispute voting */}
          {market.status === "proposer_resolved" && (
            <section className="rounded-[10px] border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">{t("market.resolution_proposed")}</p>

              {resolutionQuery.data?.review && (
                <>
                  <p className="text-[13px] text-blue-800 dark:text-blue-300">
                    {t("market.time_to_finalize")}{" "}
                    <span className="font-medium">
                      {(() => {
                        const ms = new Date(resolutionQuery.data!.review!.closes_at).getTime() - Date.now();
                        if (ms <= 0) return t("market.window_closed");
                        const h = Math.floor(ms / 3600000);
                        const m = Math.floor((ms % 3600000) / 60000);
                        return h > 0 ? `${h}h ${m}m` : `${m}m`;
                      })()}
                    </span>
                  </p>
                  <p className="text-[12px] text-blue-500 dark:text-blue-400">
                    {resolutionQuery.data.review.accept_count} {t("market.accepted")} ·{" "}
                    {resolutionQuery.data.review.dispute_count} {t("market.disputed")} ·{" "}
                    {t("market.threshold_of", { threshold: resolutionQuery.data.review.threshold, total: resolutionQuery.data.review.total_participants })}
                  </p>
                </>
              )}

              {currentUser?.id === market.proposer_id ? (
                <p className="text-[13px] text-blue-700 dark:text-blue-300 italic">{t("market.awaiting_review")}</p>
              ) : !myPosition ? (
                <p className="text-[13px] text-blue-700 dark:text-blue-300 italic">{t("market.only_participants")}</p>
              ) : resolutionQuery.data?.review?.user_vote ? (
                <p className="text-[13px] text-blue-700 dark:text-blue-300">
                  {t("market.you_voted")} <span className="font-semibold capitalize">{resolutionQuery.data.review.user_vote}</span>
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => acceptResolution.mutate()}
                      disabled={acceptResolution.isPending || openDispute.isPending}
                      className="text-[12px] px-2.5 py-[5px] rounded-md bg-green-600 text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                      {acceptResolution.isPending ? t("market.accepting") : t("market.accept_resolution")}
                    </button>
                    {confirmDisputeOpen ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] text-violet-700 dark:text-violet-300">{t("market.dispute_confirm")}</span>
                        <button
                          onClick={() => { openDispute.mutate(); setConfirmDisputeOpen(false); }}
                          disabled={openDispute.isPending}
                          className="text-[12px] px-2.5 py-[5px] rounded-md bg-violet-700 text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                        >
                          {openDispute.isPending ? t("market.disputing") : t("common.yes")}
                        </button>
                        <button
                          onClick={() => setConfirmDisputeOpen(false)}
                          className="text-[12px] px-2.5 py-[5px] rounded-md bg-[oklch(91%_0.006_250)] dark:bg-[oklch(24%_0.015_250)] text-gray-700 dark:text-gray-300 hover:opacity-80 transition-opacity"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDisputeOpen(true)}
                        disabled={openDispute.isPending || acceptResolution.isPending}
                        className="text-[12px] px-2.5 py-[5px] rounded-md bg-violet-700 text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                      >
                        {t("market.dispute_resolution")}
                      </button>
                    )}
                  </div>
                  {acceptResolution.isError && (
                    <p className="text-[13px] text-red-500 dark:text-red-400">{t("market.vote_failed")}</p>
                  )}
                  {openDispute.isError && (
                    <p className="text-[13px] text-red-500 dark:text-red-400">{t("market.action_failed")}</p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Tier 3 community dispute vote */}
          {market.status === "disputed" && (
            <section className="rounded-[10px] border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-4 space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">{t("market.community_vote")}</p>
              {resolutionQuery.data?.dispute ? (
                <>
                  <p className="text-[13px] text-violet-800 dark:text-violet-300">
                    {t("market.window_closes")} {new Date(resolutionQuery.data.dispute.closes_at).toLocaleString()}
                  </p>
                  {/* Vote tally */}
                  {market.market_type === "numeric" ? (() => {
                    const dispute = resolutionQuery.data!.dispute!;
                    const weights = dispute.vote_weights;
                    const min = market.numeric_min ?? 0;
                    const max = market.numeric_max ?? 100;
                    const BINS = 20;
                    const binSize = (max - min) / BINS;
                    const bins = Array.from({ length: BINS }, (_, i) => ({
                      label: `${(min + i * binSize).toFixed(1)}`,
                      weight: 0,
                    }));
                    Object.entries(weights).forEach(([val, w]) => {
                      const v = parseFloat(val);
                      const idx = Math.min(Math.floor((v - min) / binSize), BINS - 1);
                      if (idx >= 0) bins[idx].weight += w;
                    });
                    const peak = Math.max(...bins.map((b) => b.weight), 1);
                    const W = 320, H = 60, pad = 4;
                    const barW = (W - pad * (BINS + 1)) / BINS;
                    return (
                      <div className="space-y-2">
                        {dispute.user_vote !== null && (
                          <p className="text-sm text-violet-800 dark:text-violet-300">
                            {t("market.your_vote_label")} <span className="font-medium">{dispute.user_vote}</span>
                            {" "}<span className="text-violet-500">({dispute.user_weight?.toFixed(1)})</span>
                          </p>
                        )}
                        {Object.keys(weights).length > 0 && (
                          <div>
                            <p className="text-xs text-violet-600 dark:text-violet-400 font-medium mb-1">{t("market.community_label")}</p>
                            <svg width={W} height={H + 16} className="overflow-visible">
                              {bins.map((bin, i) => {
                                const barH = Math.round((bin.weight / peak) * H);
                                const x = pad + i * (barW + pad);
                                return (
                                  <g key={i}>
                                    <rect
                                      x={x} y={H - barH} width={barW} height={barH}
                                      className="fill-violet-500"
                                      rx={2}
                                    />
                                    {bin.weight > 0 && (
                                      <text x={x + barW / 2} y={H - barH - 3} textAnchor="middle" fontSize={9} className="fill-violet-600 dark:fill-violet-300">
                                        {bin.weight.toFixed(1)}
                                      </text>
                                    )}
                                    <text x={x + barW / 2} y={H + 12} textAnchor="middle" fontSize={8} className="fill-gray-400 dark:fill-gray-500">
                                      {bin.label}
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })() : (() => {
                    const weights = resolutionQuery.data!.dispute!.vote_weights;
                    const outcomes = market.market_type === "binary" ? ["yes", "no"] : (market.choices ?? []);
                    if (outcomes.length === 0) return null;
                    return (
                      <div className="flex gap-4 text-sm flex-wrap">
                        {outcomes.map((o) => (
                          <span key={o} className="text-violet-700 dark:text-violet-400">
                            {o.toUpperCase()} <span className="font-medium">({(weights[o] ?? 0).toFixed(1)})</span>
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                  {resolutionQuery.data.dispute.status === "open" && (
                    <div className="space-y-2">
                      <p className="text-[13px] font-medium text-violet-800 dark:text-violet-300">
                        {t("market.my_opinion")}
                        {resolutionQuery.data.dispute.user_vote && (
                          <span className="ml-2 text-[11px] text-violet-500 font-normal">
                            ({t("market.voted_change", { vote: resolutionQuery.data.dispute.user_vote.toUpperCase() })})
                          </span>
                        )}
                      </p>
                      {market.market_type === "binary" && (() => {
                        const uv = resolutionQuery.data!.dispute!.user_vote;
                        return (
                          <div className="flex gap-2">
                            {["yes", "no"].map((choice) => (
                              <button key={choice} onClick={() => castVote.mutate(choice)} disabled={castVote.isPending}
                                className={`text-[12px] px-2.5 py-[5px] rounded-md text-white disabled:opacity-40 transition-opacity ${uv === choice ? "bg-green-700 ring-2 ring-green-300 font-bold" : "bg-violet-600 hover:opacity-90"}`}>
                                {choice.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                      {market.market_type === "multiple_choice" && (() => {
                        const uv = resolutionQuery.data!.dispute!.user_vote;
                        return (
                          <div className="flex gap-2 flex-wrap">
                            {(market.choices ?? []).map((choice) => (
                              <button key={choice} onClick={() => castVote.mutate(choice)} disabled={castVote.isPending}
                                className={`text-[12px] px-2.5 py-[5px] rounded-md text-white disabled:opacity-40 transition-opacity ${uv === choice ? "bg-green-700 ring-2 ring-green-300 font-bold" : "bg-violet-600 hover:opacity-90"}`}>
                                {choice}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                      {market.market_type === "numeric" && (
                        <div className="flex gap-2 items-center">
                          <input
                            type="number"
                            min={market.numeric_min ?? undefined}
                            max={market.numeric_max ?? undefined}
                            step="any"
                            value={voteOpinion}
                            onChange={(e) => setVoteOpinion(e.target.value)}
                            placeholder={resolutionQuery.data.dispute.user_vote ?? `${market.numeric_min ?? ""}–${market.numeric_max ?? ""}`}
                            className="w-32 px-2 py-1.5 rounded-md text-[13px] bg-[oklch(97%_0.005_250)] dark:bg-[oklch(20%_0.015_250)] border border-violet-300 dark:border-violet-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-violet-500 transition-colors"
                          />
                          <button
                            onClick={() => { if (voteOpinion) castVote.mutate(voteOpinion); }}
                            disabled={castVote.isPending || !voteOpinion}
                            className="text-[12px] px-2.5 py-[5px] rounded-md bg-violet-600 text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                          >
                            {resolutionQuery.data.dispute.user_vote ? t("market.change") : t("market.submit")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {castVote.isError && <p className="text-[13px] text-red-500 dark:text-red-400">{t("market.vote_failed")}</p>}
                </>
              ) : (
                <p className="text-[13px] text-violet-600 dark:text-violet-400">{t("market.loading_dispute")}</p>
              )}
            </section>
          )}

          {/* Payout Breakdown */}
          {market?.status === "closed" && (
            <section className="rounded-[10px] border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">{t("market.payout_breakdown")}</p>
              {payoutsQuery.isLoading ? (
                <div className="space-y-2 animate-pulse">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-7 rounded-md bg-green-200/50 dark:bg-green-800/30" />
                  ))}
                </div>
              ) : payoutsQuery.isError ? (
                <p className="text-[13px] text-red-500 dark:text-red-400">{t("market.payouts_error")}</p>
              ) : !payoutsQuery.data?.payouts.length ? (
                <p className="text-[13px] text-green-700 dark:text-green-400">{t("market.no_payouts")}</p>
              ) : (
                <div className="overflow-auto max-h-64 rounded-[8px] border border-green-200 dark:border-green-800">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-green-50 dark:bg-green-900/20 z-10">
                      <tr className="border-b border-green-200 dark:border-green-800">
                        <th className="pb-2 pt-1 px-2 text-left text-[11px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider cursor-pointer select-none hover:text-green-800 dark:hover:text-green-200" onClick={() => toggleSort(payoutSort, setPayoutSort, "username")}>
                          {t("market.winner_user")}{sortIndicator(payoutSort, "username")}
                        </th>
                        <th className="pb-2 pt-1 px-2 text-right text-[11px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider cursor-pointer select-none hover:text-green-800 dark:hover:text-green-200" onClick={() => toggleSort(payoutSort, setPayoutSort, "bp_won")}>
                          {t("market.winner_bp")}{sortIndicator(payoutSort, "bp_won")}
                        </th>
                        <th className="pb-2 pt-1 px-2 text-right text-[11px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider cursor-pointer select-none hover:text-green-800 dark:hover:text-green-200" onClick={() => toggleSort(payoutSort, setPayoutSort, "tp_won")}>
                          {t("market.winner_tp")}{sortIndicator(payoutSort, "tp_won")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-green-100 dark:divide-green-800/50">
                      {sortedRows(payoutsQuery.data.payouts, payoutSort).map((p) => (
                        <tr key={p.user_id} className="hover:bg-green-100/50 dark:hover:bg-green-900/30 transition-colors duration-100">
                          <td className="py-2 px-2 text-[13px]"><UserLink username={p.username} className="text-[var(--accent)]" /></td>
                          <td className="py-2 px-2 text-right text-[13px] font-medium tabular-nums text-green-600 dark:text-green-400">+{p.bp_won} BP</td>
                          <td className="py-2 px-2 text-right text-[13px] font-medium tabular-nums text-[var(--accent)]">+{p.tp_won} TP</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {!myPosition && market.status === "open" && <section className="rounded-[10px] bg-white dark:bg-[oklch(18%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(22%_0.015_250)] p-4">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t("market.place_your_bet")}</p>
            {market.market_type === "binary" && (
              <div className="mb-3 flex gap-2">
                <button
                  className={`text-[12px] px-2.5 py-[5px] rounded-md transition-colors ${side === "yes" ? "bg-green-600 text-white" : "bg-[oklch(91%_0.006_250)] dark:bg-[oklch(24%_0.015_250)] text-gray-700 dark:text-gray-300"}`}
                  onClick={() => setSide("yes")}
                >
                  YES
                </button>
                <button
                  className={`text-[12px] px-2.5 py-[5px] rounded-md transition-colors ${side === "no" ? "bg-red-600 text-white" : "bg-[oklch(91%_0.006_250)] dark:bg-[oklch(24%_0.015_250)] text-gray-700 dark:text-gray-300"}`}
                  onClick={() => setSide("no")}
                >
                  NO
                </button>
              </div>
            )}
            {market.market_type === "multiple_choice" && (
              <div className="mb-3 flex flex-wrap gap-2">
                {(market.choices ?? []).map((choice) => (
                  <button
                    key={choice}
                    className={`text-[12px] px-2.5 py-[5px] rounded-md transition-colors ${side === choice ? "bg-[var(--accent)] text-white" : "bg-[oklch(91%_0.006_250)] dark:bg-[oklch(24%_0.015_250)] text-gray-700 dark:text-gray-300"}`}
                    onClick={() => setSide(choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            )}
            {market.market_type === "numeric" && (
              <div className="mb-3">
                <label className="block text-[13px] text-gray-500 dark:text-gray-400 mb-1">
                  {t("market.your_estimate", { min: market.numeric_min ?? 0, max: market.numeric_max ?? 100 })}
                </label>
                <input
                  type="number"
                  min={market.numeric_min ?? undefined}
                  max={market.numeric_max ?? undefined}
                  step="any"
                  value={side}
                  onChange={(e) => setSide(e.target.value)}
                  className="w-40 px-3 py-1.5 rounded-md text-[13px] bg-[oklch(97%_0.005_250)] dark:bg-[oklch(20%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(24%_0.015_250)] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            )}
            {maxBetAmount > 0 ? (
              <div className="mb-3 flex items-center gap-2">
                <label className="text-[13px] text-gray-500 dark:text-gray-400">{t("market.bet_amount_label")}</label>
                <select
                  value={clampedBetAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  className="px-2 py-1.5 rounded-md text-[13px] bg-[oklch(97%_0.005_250)] dark:bg-[oklch(20%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(24%_0.015_250)] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[var(--accent)] transition-colors"
                >
                  {Array.from({ length: maxBetAmount }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n} BP</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="mb-3 text-[13px] text-red-500 dark:text-red-400">{t("market.need_min_1bp")}</p>
            )}
            <button
              onClick={() => placeBet.mutate()}
              disabled={placeBet.isPending || maxBetAmount < 1}
              className="text-[13px] px-3 py-2 rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {placeBet.isPending ? t("market.placing") : t("market.place_1bp")}
            </button>
            {placeBet.isError && <p className="mt-2 text-[13px] text-red-500 dark:text-red-400">{t("market.bet_error")}</p>}
          </section>}

          <section className="rounded-[10px] bg-white dark:bg-[oklch(18%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(22%_0.015_250)] p-4">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t("market.comments")}</p>
            {aiEnabled && <div className="mb-3">
              {summary ? (
                <div className="rounded-[8px] bg-[oklch(97%_0.005_250)] dark:bg-[oklch(20%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(24%_0.015_250)] p-3 text-[13px] text-gray-800 dark:text-gray-200 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t("market.ai_summary")}</p>
                  <div className="prose prose-sm max-w-none"><ReactMarkdown>{summary}</ReactMarkdown></div>
                  <button onClick={() => setSummary(null)} className="text-[12px] text-[var(--accent)] hover:underline">
                    {t("market.refresh")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGetSummary}
                  disabled={summaryLoading}
                  className="text-[12px] px-2.5 py-[5px] rounded-md border border-[oklch(88%_0.005_250)] dark:border-[oklch(28%_0.015_250)] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-40 transition-colors"
                >
                  {summaryLoading ? t("market.summarizing") : t("market.summarize_discussion")}
                </button>
              )}
            </div>}
            <form onSubmit={onSubmitComment} className="mb-4 flex gap-2">
              <input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                className="flex-1 px-3 py-2 rounded-md text-[13px] bg-[oklch(97%_0.005_250)] dark:bg-[oklch(20%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(24%_0.015_250)] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors"
                placeholder={t("market.share_reasoning")}
              />
              <button
                type="submit"
                disabled={postComment.isPending}
                className="text-[13px] px-3 py-2 rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {t("market.post")}
              </button>
            </form>

            <div className="space-y-2">
              {orderedComments.map((comment) => {
                if (isCommentHidden(comment)) return null;
                const depth = commentDepthMap.get(comment.id) ?? 0;
                const hasChildren = (commentChildrenMap.get(comment.id)?.length ?? 0) > 0;
                const isCollapsed = collapsedComments.has(comment.id);
                return (
                  <div
                    key={comment.id}
                    style={{ marginLeft: `${depth * 20}px` }}
                    className="rounded-[8px] border border-[oklch(91%_0.006_250)] dark:border-[oklch(22%_0.015_250)] p-3"
                  >
                    <UserLink username={comment.author_username} className="text-[12px] font-medium text-[var(--accent)] mb-1 block" />
                    <p className="text-[13px] text-gray-800 dark:text-gray-200">{comment.content}</p>
                    <div className="mt-2 flex items-center gap-3 text-[12px] text-gray-400 dark:text-gray-500">
                      <span>{new Date(comment.created_at).toLocaleString()}</span>
                      <button
                        onClick={() => comment.user_has_liked
                          ? unlikeComment.mutate(comment.id)
                          : upvoteComment.mutate(comment.id)
                        }
                        className={`flex items-center gap-1 transition-colors ${comment.user_has_liked ? "text-red-500" : "text-gray-400 hover:text-red-500"}`}
                      >
                        <span className="text-[13px] leading-none">{comment.user_has_liked ? "❤️" : "♡"}</span>
                        <span>{comment.upvote_count}</span>
                      </button>
                      {depth < MAX_COMMENT_DEPTH && (
                        <button
                          title={t("market.reply")}
                          onClick={() => {
                            setReplyText("");
                            setReplyingTo(replyingTo === comment.id ? null : comment.id);
                          }}
                          className="flex items-center p-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 17 4 12 9 7"/>
                            <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                          </svg>
                        </button>
                      )}
                      {hasChildren && (
                        <button
                          title={isCollapsed ? t("market.expand_replies") : t("market.collapse_replies")}
                          onClick={() => toggleCollapsed(comment.id)}
                          className="text-[13px] px-1.5 py-0.5 rounded font-mono text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                        >
                          {isCollapsed ? `»(${countDescendants(comment.id)})` : "»"}
                        </button>
                      )}
                    </div>
                    {replyingTo === comment.id && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!replyText.trim()) return;
                          postComment.mutate({ content: replyText.trim(), parentId: comment.id });
                        }}
                        className="mt-2 flex gap-2"
                      >
                        <input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-md text-[13px] bg-[oklch(97%_0.005_250)] dark:bg-[oklch(20%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(24%_0.015_250)] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors"
                          placeholder={t("market.write_reply")}
                          autoFocus
                        />
                        <button type="submit" className="text-[12px] px-2.5 py-[5px] rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity">
                          {t("market.post")}
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
              {commentsQuery.isLoading && <p className="text-[13px] text-gray-400 dark:text-gray-500">{t("market.loading_comments")}</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
