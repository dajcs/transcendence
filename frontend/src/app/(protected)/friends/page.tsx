"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useFriendsStore } from "@/store/friends";
import { useSocketStore } from "@/store/socket";
import type { BlockedUser } from "@/lib/friends-types";
import { api } from "@/lib/api";
import UserLink from "@/components/UserLink";
import { useT } from "@/i18n";

interface SearchResult {
  id: string;
  username: string;
  avatar_url: string | null;
}

function UserSearch() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { sendRequest } = useFriendsStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    if (!value.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      try {
        const { data } = await api.get<SearchResult[]>("/api/users/search", {
          params: { q: value.trim() },
          signal: controller.signal,
        });
        setResults(data);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
  };

  const handleSendRequest = async (userId: string) => {
    setSendingTo(userId);
    setErrors((prev) => { const e = { ...prev }; delete e[userId]; return e; });
    const error = await sendRequest(userId);
    if (error) {
      setErrors((prev) => ({ ...prev, [userId]: error }));
    } else {
      setSentTo((prev) => new Set(prev).add(userId));
    }
    setSendingTo(null);
  };

  return (
    <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <label htmlFor="user-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {t("friends.add_friend")}
      </label>
      <input
        id="user-search"
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={t("friends.search_placeholder")}
        className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      />
      {searching && <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{t("friends.searching")}</p>}
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-700">
          {results.map((user) => (
            <li key={user.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300">
                  {user.username[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.username}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={() => handleSendRequest(user.id)}
                  disabled={sendingTo === user.id || sentTo.has(user.id)}
                  className={`rounded px-3 py-1 text-sm text-white ${
                    sentTo.has(user.id)
                      ? "bg-gray-400 dark:bg-gray-500 cursor-default"
                      : "bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  }`}
                >
                  {sentTo.has(user.id) ? t("friends.sent_label") : sendingTo === user.id ? t("friends.sending") : t("friends.add_friend")}
                </button>
                {errors[user.id] && (
                  <span className="text-xs text-red-500">{errors[user.id]}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && !searching && results.length === 0 && (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{t("friends.no_users_found")}</p>
      )}
    </div>
  );
}

export default function FriendsPage() {
  const t = useT();
  const {
    friends,
    pendingReceived,
    pendingSent,
    blocked,
    isLoading,
    fetch,
    acceptRequest,
    rejectRequest,
    removeFriend,
    blockUser,
    unblockUser,
    cancelRequest,
  } = useFriendsStore();

  const socket = useSocketStore((s) => s.socket);
  const [activeTab, setActiveTab] = useState<"friends" | "received" | "sent" | "blocked">("friends");

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "received") setActiveTab("received");
    fetch();
  }, [fetch]);

  // Re-fetch when friend status changes via socket
  useEffect(() => {
    if (!socket) return;
    socket.on("notification:friend_accepted", fetch);
    socket.on("notification:friend_request", fetch);
    socket.on("friend:removed", fetch);
    return () => {
      socket.off("notification:friend_accepted", fetch);
      socket.off("notification:friend_request", fetch);
      socket.off("friend:removed", fetch);
    };
  }, [socket, fetch]);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setActiveTab(e.detail as "friends" | "received" | "sent" | "blocked");
      fetch();
    };
    window.addEventListener("friends:open-tab", handler as EventListener);
    return () => window.removeEventListener("friends:open-tab", handler as EventListener);
  }, [fetch]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("friends.title")}</h1>

      {/* User search / Add Friend */}
      <UserSearch />

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("friends")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "friends"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          {t("friends.all")} ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab("received")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "received"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          {t("friends.requests")} ({pendingReceived.length})
          {pendingReceived.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
              {pendingReceived.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("sent")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "sent"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          {t("friends.sent")} ({pendingSent.length})
        </button>
        {blocked.length > 0 && (
          <button
            onClick={() => setActiveTab("blocked")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "blocked"
                ? "border-red-600 text-red-600"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t("friends.blocked")} ({blocked.length})
          </button>
        )}
      </div>

      {isLoading && <p className="text-sm text-gray-500 dark:text-gray-400">{t("common.loading")}</p>}

      {/* Friends list */}
      {activeTab === "friends" && (
        <div className="space-y-2">
          {friends.length === 0 && !isLoading && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("friends.no_friends")}</p>
          )}
          {friends.map((friend) => (
            <div
              key={friend.user_id}
              className="flex items-center justify-between rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300">
                    {friend.username[0].toUpperCase()}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-800 ${
                      friend.is_online ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <UserLink username={friend.username} className="font-medium text-gray-900 dark:text-gray-100" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("friends.friends_since")} {new Date(friend.since).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/chat/${friend.user_id}`}
                  className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                >
                  {t("friends.send_message")}
                </Link>
                <button
                  onClick={() => removeFriend(friend.user_id)}
                  className="rounded border border-red-300 dark:border-red-700 px-3 py-1 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {t("friends.remove")}
                </button>
                <button
                  onClick={() => blockUser(friend.user_id)}
                  className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t("friends.block")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending received */}
      {activeTab === "received" && (
        <div className="space-y-2">
          {pendingReceived.length === 0 && !isLoading && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("friends.no_pending")}</p>
          )}
          {pendingReceived.map((req) => (
            <div
              key={req.id}
              className="flex items-center justify-between rounded border border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 p-4"
            >
              <div>
                <UserLink username={req.from_username} className="font-medium text-gray-900 dark:text-gray-100" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("friends.sent_date")} {new Date(req.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => { await acceptRequest(req.id); setActiveTab("friends"); }}
                  className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                >
                  {t("friends.accept")}
                </button>
                <button
                  onClick={() => rejectRequest(req.id)}
                  className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t("friends.decline")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Blocked users */}
      {activeTab === "blocked" && (
        <div className="space-y-2">
          {blocked.map((u: BlockedUser) => (
            <div
              key={u.user_id}
              className="flex items-center justify-between rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
            >
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300">
                  {u.username[0].toUpperCase()}
                </div>
                <UserLink username={u.username} className="text-sm font-medium text-gray-900 dark:text-gray-100" />
              </div>
              <button
                onClick={() => unblockUser(u.user_id)}
                className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {t("friends.unblock")}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pending sent */}
      {activeTab === "sent" && (
        <div className="space-y-2">
          {pendingSent.length === 0 && !isLoading && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("friends.no_sent")}</p>
          )}
          {pendingSent.map((req) => (
            <div
              key={req.id}
              className="flex items-center justify-between rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
            >
              <div>
                <UserLink username={req.to_username} className="font-medium text-gray-900 dark:text-gray-100" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("friends.sent_date")} {new Date(req.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => cancelRequest(req.id)}
                className="rounded border border-red-300 dark:border-red-700 px-3 py-1 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                {t("friends.cancel_request")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
