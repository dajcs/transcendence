"use client";

import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { BetPosition, Comment, Market } from "@/lib/types";

export default function MarketDetailPage() {
  const params = useParams<{ id: string }>();
  const marketId = params.id;
  const queryClient = useQueryClient();

  const [side, setSide] = useState<"yes" | "no">("yes");
  const [commentText, setCommentText] = useState("");

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
    },
  });

  const postComment = useMutation({
    mutationFn: async (content: string) =>
      api.post(`/api/markets/${marketId}/comments`, { content }),
    onSuccess: async () => {
      setCommentText("");
      await queryClient.invalidateQueries({ queryKey: ["comments", marketId] });
    },
  });

  const upvoteComment = useMutation({
    mutationFn: async (commentId: string) => api.post(`/api/comments/${commentId}/upvote`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["comments", marketId] });
    },
  });

  const onSubmitComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commentText.trim()) {
      return;
    }
    postComment.mutate(commentText.trim());
  };

  const market = marketQuery.data;

  return (
    <div className="space-y-6">
      {marketQuery.isLoading && <p className="text-sm text-gray-500">Loading market...</p>}
      {marketQuery.isError && <p className="text-sm text-red-600">Failed to load market.</p>}

      {market && (
        <>
          <header className="space-y-2">
            <h1 className="text-2xl font-bold">{market.title}</h1>
            <p className="text-sm text-gray-600">{market.description}</p>
            <p className="text-sm text-gray-500">Resolution: {market.resolution_criteria}</p>
          </header>

          <section className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-lg font-semibold">Live Odds</h2>
            <div className="mb-2 h-3 overflow-hidden rounded bg-gray-200">
              <div className="h-full bg-green-500" style={{ width: `${market.yes_pct}%` }} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-green-600">YES {market.yes_pct}%</span>
              <span className="font-semibold text-red-600">NO {market.no_pct}%</span>
            </div>
          </section>

          <section className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Place Bet</h2>
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
            <button
              onClick={() => placeBet.mutate()}
              disabled={placeBet.isPending}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {placeBet.isPending ? "Placing..." : "Place 1 BP Bet"}
            </button>
            {placeBet.isError && <p className="mt-2 text-sm text-red-600">Unable to place bet.</p>}
          </section>

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
