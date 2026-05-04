"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useFriendsStore } from "@/store/friends";
import { useSocketStore } from "@/store/socket";
import type { BlockedUser } from "@/lib/friends-types";
import { api } from "@/lib/api";
import Avatar from "@/components/Avatar";
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
    if (!value.trim()) { setResults([]); return; }
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
    <div className="bg-white dark:bg-[oklch(18%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(22%_0.015_250)] rounded-[10px] p-3 mb-3">
      <div className="relative mb-2">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 opacity-35 pointer-events-none text-gray-900 dark:text-gray-100"
          width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden
        >
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          id="user-search"
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t("friends.search_placeholder")}
          className="w-full pl-8 pr-3 py-2 rounded-lg text-[13px] bg-[oklch(97%_0.005_250)] dark:bg-[oklch(20%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(24%_0.015_250)] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>
      {searching && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 px-1">{t("friends.searching")}</p>
      )}
      {results.length > 0 && (
        <div className="mt-1 border border-[oklch(91%_0.006_250)] dark:border-[oklch(22%_0.015_250)] rounded-lg overflow-hidden">
          {results.map((user, i) => (
            <div
              key={user.id}
              className={`flex items-center justify-between px-3 py-2 hover:bg-[oklch(97%_0.008_264)] dark:hover:bg-[oklch(20%_0.015_250)] transition-colors duration-100 ${
                i < results.length - 1 ? "border-b border-gray-100 dark:border-[oklch(22%_0.015_250)]" : ""
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Avatar username={user.username} avatarUrl={user.avatar_url} />
                <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{user.username}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={() => handleSendRequest(user.id)}
                  disabled={sendingTo === user.id || sentTo.has(user.id)}
                  className={`text-[12px] px-2.5 py-[5px] rounded-md font-semibold transition-opacity ${
                    sentTo.has(user.id)
                      ? "bg-[oklch(91%_0.006_250)] dark:bg-[oklch(24%_0.015_250)] text-gray-500 dark:text-gray-400 cursor-default"
                      : "bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
                  }`}
                >
                  {sentTo.has(user.id)
                    ? t("friends.sent_label")
                    : sendingTo === user.id
                    ? t("friends.sending")
                    : t("friends.add_friend")}
                </button>
                {errors[user.id] && (
                  <span className="text-[11px] text-red-500">{errors[user.id]}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {query.trim() && !searching && results.length === 0 && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 px-1 mt-1">{t("friends.no_users_found")}</p>
      )}
    </div>
  );
}

export default function FriendsPage() {
  const t = useT();
  const {
    friends, pendingReceived, pendingSent, blocked,
    isLoading, fetch, acceptRequest, rejectRequest,
    removeFriend, blockUser, unblockUser, cancelRequest,
  } = useFriendsStore();

  const socket = useSocketStore((s) => s.socket);
  const [activeTab, setActiveTab] = useState<"friends" | "received" | "sent" | "blocked">("friends");

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "received") setActiveTab("received");
    fetch();
  }, [fetch]);

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

  const tabs = [
    { key: "friends" as const, label: `${t("friends.all")} (${friends.length})` },
    { key: "received" as const, label: `${t("friends.requests")} (${pendingReceived.length})`, badge: pendingReceived.length },
    { key: "sent" as const, label: `${t("friends.sent")} (${pendingSent.length})` },
    ...(blocked.length > 0 ? [{ key: "blocked" as const, label: `${t("friends.blocked")} (${blocked.length})` }] : []),
  ];

  return (
    <div>
      <UserSearch />

      {/* Tab filter row — matches markets filter pill style */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {tabs.map(({ key, label, badge }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`text-[12px] px-2.5 py-[5px] rounded-md cursor-pointer whitespace-nowrap border transition-colors ${
                isActive
                  ? "bg-[oklch(91%_0.006_250)] dark:bg-[oklch(24%_0.015_250)] border-[oklch(88%_0.005_250)] dark:border-[oklch(28%_0.015_250)] text-gray-900 dark:text-gray-100 font-semibold"
                  : "border-transparent text-gray-400 dark:text-gray-500 font-medium"
              }`}
            >
              {label}
              {badge != null && badge > 0 && (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <p className="text-[13px] text-gray-400 dark:text-gray-500 py-6 text-center">{t("common.loading")}</p>
      )}

      {/* Content card — matches markets rows card */}
      {!isLoading && (
        <div className="bg-white dark:bg-[oklch(18%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(22%_0.015_250)] rounded-[10px] overflow-hidden">

          {/* Friends */}
          {activeTab === "friends" && (
            friends.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-gray-400 dark:text-gray-500">{t("friends.no_friends")}</div>
            ) : friends.map((friend, i) => (
              <div
                key={friend.user_id}
                className={`flex items-center justify-between px-3 py-2.5 hover:bg-[oklch(97%_0.008_264)] dark:hover:bg-[oklch(20%_0.015_250)] transition-colors duration-100 ${
                  i < friends.length - 1 ? "border-b border-gray-100 dark:border-[oklch(22%_0.015_250)]" : ""
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <Avatar username={friend.username} avatarUrl={friend.avatar_url} />
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[oklch(18%_0.015_250)] ${
                      friend.is_online ? "bg-green-500" : "bg-gray-400 dark:bg-gray-600"
                    }`} />
                  </div>
                  <div>
                    <UserLink username={friend.username} className="text-[13px] font-medium text-gray-900 dark:text-gray-100" />
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      {t("friends.friends_since")} {new Date(friend.since).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Link
                    href={`/chat/${friend.user_id}`}
                    className="text-[12px] px-2.5 py-[5px] rounded-md font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
                  >
                    {t("friends.send_message")}
                  </Link>
                  <button
                    onClick={() => removeFriend(friend.user_id)}
                    className="text-[12px] px-2.5 py-[5px] rounded-md border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    {t("friends.remove")}
                  </button>
                  <button
                    onClick={() => blockUser(friend.user_id)}
                    className="text-[12px] px-2.5 py-[5px] rounded-md border border-[oklch(91%_0.006_250)] dark:border-[oklch(24%_0.015_250)] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    {t("friends.block")}
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Received requests */}
          {activeTab === "received" && (
            pendingReceived.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-gray-400 dark:text-gray-500">{t("friends.no_pending")}</div>
            ) : pendingReceived.map((req, i) => (
              <div
                key={req.id}
                className={`flex items-center justify-between px-3 py-2.5 hover:bg-[oklch(97%_0.008_264)] dark:hover:bg-[oklch(20%_0.015_250)] transition-colors duration-100 ${
                  i < pendingReceived.length - 1 ? "border-b border-gray-100 dark:border-[oklch(22%_0.015_250)]" : ""
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Avatar username={req.from_username} avatarUrl={req.from_avatar_url} />
                  <div>
                    <UserLink username={req.from_username} className="text-[13px] font-medium text-gray-900 dark:text-gray-100" />
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      {t("friends.sent_date")} {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={async () => { await acceptRequest(req.id); setActiveTab("friends"); }}
                    className="text-[12px] px-2.5 py-[5px] rounded-md font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
                  >
                    {t("friends.accept")}
                  </button>
                  <button
                    onClick={() => rejectRequest(req.id)}
                    className="text-[12px] px-2.5 py-[5px] rounded-md border border-[oklch(91%_0.006_250)] dark:border-[oklch(24%_0.015_250)] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    {t("friends.decline")}
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Sent requests */}
          {activeTab === "sent" && (
            pendingSent.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-gray-400 dark:text-gray-500">{t("friends.no_sent")}</div>
            ) : pendingSent.map((req, i) => (
              <div
                key={req.id}
                className={`flex items-center justify-between px-3 py-2.5 hover:bg-[oklch(97%_0.008_264)] dark:hover:bg-[oklch(20%_0.015_250)] transition-colors duration-100 ${
                  i < pendingSent.length - 1 ? "border-b border-gray-100 dark:border-[oklch(22%_0.015_250)]" : ""
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Avatar username={req.to_username} avatarUrl={req.to_avatar_url} />
                  <div>
                    <UserLink username={req.to_username} className="text-[13px] font-medium text-gray-900 dark:text-gray-100" />
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      {t("friends.sent_date")} {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => cancelRequest(req.id)}
                  className="text-[12px] px-2.5 py-[5px] rounded-md border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  {t("friends.cancel_request")}
                </button>
              </div>
            ))
          )}

          {/* Blocked */}
          {activeTab === "blocked" && (
            blocked.map((u: BlockedUser, i) => (
              <div
                key={u.user_id}
                className={`flex items-center justify-between px-3 py-2.5 hover:bg-[oklch(97%_0.008_264)] dark:hover:bg-[oklch(20%_0.015_250)] transition-colors duration-100 ${
                  i < blocked.length - 1 ? "border-b border-gray-100 dark:border-[oklch(22%_0.015_250)]" : ""
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Avatar username={u.username} avatarUrl={u.avatar_url} />
                  <UserLink username={u.username} className="text-[13px] font-medium text-gray-900 dark:text-gray-100" />
                </div>
                <button
                  onClick={() => unblockUser(u.user_id)}
                  className="text-[12px] px-2.5 py-[5px] rounded-md border border-[oklch(91%_0.006_250)] dark:border-[oklch(24%_0.015_250)] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  {t("friends.unblock")}
                </button>
              </div>
            ))
          )}

        </div>
      )}
    </div>
  );
}
