"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { BetPosition, BetPositionsListResponse, Comment, Market } from "@/lib/types";

function estimateRefund(position: { side: string }, market: Market): { bp: number; reason: string } {
  if (market.market_type === "numeric") {
    const entries = Object.entries(market.choice_counts);
    const totalVotes = entries.reduce((s, [, c]) => s + c, 0);
    const mean = totalVotes > 0
      ? entries.reduce((s, [v, c]) => s + parseFloat(v) * c, 0) / totalVotes
      : parseFloat(position.side);
    const span = (market.numeric_max ?? 1) - (market.numeric_min ?? 0);
    const bp = span > 0 ? Math.max(0, 1 - Math.abs(parseFloat(position.side) - mean) / span) : 1;
    return { bp: Math.round(bp * 100) / 100, reason: "based on consensus proximity" };
  }
  if (market.market_type === "binary") {
    const bp = position.side === "yes" ? market.yes_pct / 100 : market.no_pct / 100;
    return { bp: Math.round(bp * 100) / 100, reason: "based on current winning probability" };
  }
  // multiple_choice
  const total = market.position_count || 1;
  const count = market.choice_counts[position.side] ?? 0;
  const bp = count / total;
  return { bp: Math.round(bp * 100) / 100, reason: "based on current winning probability" };
}

export default function MarketDetailPage() {
  const params = useParams<{ id: string }>();
  const marketId = params.id;
  const queryClient = useQueryClient();
  const bootstrap = useAuthStore((s) => s.bootstrap);

  const [side, setSide] = useState<string>("yes");
  const [commentText, setCommentText] = useState("");
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const positionsQuery = useQuery<BetPositionsListResponse>({
    queryKey: ["positions"],
    queryFn: async () => (await api.get("/api/bets/positions")).data,
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

  const placeBet = useMutation({
    mutationFn: async () => (await api.post<BetPosition>("/api/bets", { bet_id: marketId, side })).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["market", marketId] });
      await queryClient.invalidateQueries({ queryKey: ["positions"] });
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

  const withdrawBet = useMutation({
    mutationFn: (positionId: string) => api.delete(`/api/bets/${positionId}`),
    onSuccess: async () => {
      setShowWithdrawConfirm(false);
      await queryClient.invalidateQueries({ queryKey: ["positions"] });
      await queryClient.invalidateQueries({ queryKey: ["market", marketId] });
      await bootstrap();
    },
  });

  const onSubmitComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commentText.trim()) {
      return;
    }
    postComment.mutate({ content: commentText.trim(), parentId: null });
  };

  const market = marketQuery.data;
  const refundEstimate = market && myPosition ? estimateRefund(myPosition, market) : null;

  useEffect(() => {
    if (!market) return;
    if (market.market_type === "numeric") {
      setSide(String(((market.numeric_min ?? 0) + (market.numeric_max ?? 100)) / 2));
    } else if (market.market_type === "multiple_choice" && market.choices?.length) {
      setSide(market.choices[0]);
    }
    // binary: "yes" default is correct
  }, [market?.market_type]);

  return (
    <div className="space-y-6">
      {marketQuery.isLoading && <p className="text-sm text-gray-500">Loading market...</p>}
      {marketQuery.isError && <p className="text-sm text-red-600">Failed to load market.</p>}

      {market && (
        <>
          <header className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold">{market.title}</h1>
              <button
                onClick={() => upvoteMarket.mutate()}
                disabled={upvoteMarket.isPending}
                className="shrink-0 rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
              >
                ▲ {market.upvote_count}
              </button>
            </div>
            <p className="text-sm text-gray-600">{market.description}</p>
            <p className="text-sm text-gray-500">Resolution: {market.resolution_criteria}</p>
          </header>

          <section className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-lg font-semibold">Live Odds</h2>
            {market.market_type === "binary" && (
              <>
                <div className="mb-2 h-3 overflow-hidden rounded bg-gray-200">
                  <div className="h-full bg-green-500" style={{ width: `${market.yes_pct}%` }} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-green-600">YES {market.yes_pct}% ({market.yes_count})</span>
                  <span className="font-semibold text-red-600">NO {market.no_pct}% ({market.no_count})</span>
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
                      <div className="flex justify-between text-sm mb-1">
                        <span>{choice}</span>
                        <span className="text-gray-500">{count} votes ({pct}%)</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded bg-gray-200">
                        <div className="h-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-gray-500 pt-1">{market.position_count} total votes</p>
              </div>
            )}
            {market.market_type === "numeric" && (() => {
              const min = market.numeric_min ?? 0;
              const max = market.numeric_max ?? 100;
              const BINS = 10;
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
              const W = 320, H = 80, pad = 4;
              const barW = (W - pad * (BINS + 1)) / BINS;
              return (
                <div>
                  <p className="text-xs text-gray-500 mb-2">
                    Range: {min} – {max} · {market.position_count} votes
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
                            <text x={x + barW / 2} y={H - barH - 3} textAnchor="middle" fontSize={9} className="fill-gray-600">
                              {bin.count}
                            </text>
                          )}
                          <text x={x + barW / 2} y={H + 12} textAnchor="middle" fontSize={8} className="fill-gray-400">
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

          {myPosition && market && (
            <section className="rounded border border-blue-200 bg-blue-50 p-4">
              <h2 className="mb-2 text-lg font-semibold text-blue-900">Your Position</h2>
              <p className="text-sm text-blue-800">
                {market.market_type === "numeric" ? (
                  <>Estimate: <span className="font-medium">{myPosition.side}</span></>
                ) : market.market_type === "multiple_choice" ? (
                  <>Choice: <span className="font-medium">{myPosition.side}</span></>
                ) : (
                  <>Side: <span className="font-medium">{myPosition.side.toUpperCase()}</span></>
                )}
                {" · "}Staked: <span className="font-medium">{myPosition.bp_staked} BP</span>
                {" · "}Est. refund: <span className="font-medium">{refundEstimate!.bp} BP</span>
              </p>
              {!showWithdrawConfirm ? (
                <button
                  onClick={() => setShowWithdrawConfirm(true)}
                  className="mt-3 rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                >
                  Withdraw
                </button>
              ) : (
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <p className="text-sm text-red-700">
                    Refund {refundEstimate!.bp} BP{" "}
                    <span className="text-gray-500">({refundEstimate!.reason})</span>
                  </p>
                  <button
                    onClick={() => withdrawBet.mutate(myPosition.id)}
                    disabled={withdrawBet.isPending}
                    className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {withdrawBet.isPending ? "Withdrawing..." : "Confirm"}
                  </button>
                  <button
                    onClick={() => setShowWithdrawConfirm(false)}
                    className="text-sm text-gray-600 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {withdrawBet.isError && (
                <p className="mt-2 text-sm text-red-600">Withdrawal failed.</p>
              )}
            </section>
          )}

          {!myPosition && <section className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Place Bet</h2>
            {market.market_type === "binary" && (
              <div className="mb-3 flex gap-2">
                <button
                  className={`rounded px-3 py-1 text-sm ${side === "yes" ? "bg-green-600 text-white" : "bg-gray-200"}`}
                  onClick={() => setSide("yes")}
                >
                  YES
                </button>
                <button
                  className={`rounded px-3 py-1 text-sm ${side === "no" ? "bg-red-600 text-white" : "bg-gray-200"}`}
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
                    className={`rounded px-3 py-1 text-sm ${side === choice ? "bg-blue-600 text-white" : "bg-gray-200"}`}
                    onClick={() => setSide(choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            )}
            {market.market_type === "numeric" && (
              <div className="mb-3">
                <label className="block text-sm mb-1">
                  Your estimate ({market.numeric_min} – {market.numeric_max})
                </label>
                <input
                  type="number"
                  min={market.numeric_min ?? undefined}
                  max={market.numeric_max ?? undefined}
                  step="any"
                  value={side}
                  onChange={(e) => setSide(e.target.value)}
                  className="rounded border border-gray-300 px-3 py-1 text-sm w-40"
                />
              </div>
            )}
            <button
              onClick={() => placeBet.mutate()}
              disabled={placeBet.isPending}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {placeBet.isPending ? "Placing..." : "Place 1 BP Bet"}
            </button>
            {placeBet.isError && <p className="mt-2 text-sm text-red-600">Unable to place bet.</p>}
          </section>}

          <section className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Comments</h2>
            <form onSubmit={onSubmitComment} className="mb-4 flex gap-2">
              <input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Share your reasoning"
              />
              <button
                type="submit"
                disabled={postComment.isPending}
                className="rounded bg-gray-900 px-4 py-2 text-sm text-white"
              >
                Post
              </button>
            </form>

            <div className="space-y-2">
              {commentsQuery.data?.map((comment) => (
                <div key={comment.id} className="rounded border border-gray-200 p-3">
                  <p className="text-sm text-gray-800">{comment.content}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>{new Date(comment.created_at).toLocaleString()}</span>
                    <button
                      onClick={() => upvoteComment.mutate(comment.id)}
                      className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-100"
                    >
                      Upvote ({comment.upvote_count})
                    </button>
                  </div>
                </div>
              ))}
              {commentsQuery.isLoading && <p className="text-sm text-gray-500">Loading comments...</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
