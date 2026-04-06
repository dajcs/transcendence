"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/store/notifications";
import { useSocketStore } from "@/store/socket";

function parsePayload(payload: string | null): { message?: string; bet_id?: string; market_id?: string } {
  if (!payload) return {};
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

function getNotificationLink(type: string, data: { bet_id?: string; market_id?: string }): string | null {
  if (type === "bet_resolved" || type === "bet_disputed") {
    return data.bet_id ? `/markets/${data.bet_id}` : null;
  }
  if (type === "resolution_due") {
    return data.market_id ? `/markets/${data.market_id}` : "/dashboard?tab=my_markets";
  }
  if (type === "friend_request") return "/friends?tab=received";
  if (type === "friend_accepted") return "/friends";
  if (type === "new_message") return "/chat";
  return null;
}

const TYPE_LABELS: Record<string, string> = {
  friend_request: "Friend Request",
  friend_accepted: "Friend Accepted",
  friend_removed: "Friendship Ended",
  new_message: "New Message",
  bet_resolved: "Bet Resolved",
  bet_disputed: "Bet Disputed",
  resolution_due: "Resolution Required",
};

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    isOpen,
    fetch,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    toggle,
    close,
  } = useNotificationStore();

  const markAllAsReadRef = useRef(markAllAsRead);
  markAllAsReadRef.current = markAllAsRead;

  const router = useRouter();
  const socket = useSocketStore((s) => s.socket);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initial fetch on mount (REST — for already-stored notifications)
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Request browser notification permission once on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Socket listener for new notification events (replaces 10s poll per D-10)
  useEffect(() => {
    if (!socket) return;

    const showBrowserNotification = (body: string, url?: string) => {
      if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
      const n = new Notification("Vox Populi", { body, icon: "/favicon.ico", requireInteraction: true });
      n.onclick = () => {
        window.focus();
        markAllAsReadRef.current();
        if (url) router.push(url);
        n.close();
      };
    };

    const handler = () => {
      fetchUnreadCount();
    };

    const handleWithMarketLink = (data: { payload?: string }, fallbackBody: string) => {
      fetchUnreadCount();
      try {
        const payload = JSON.parse(data?.payload ?? "{}");
        const url = payload.bet_id ? `/markets/${payload.bet_id}` : payload.market_id ? `/markets/${payload.market_id}` : undefined;
        showBrowserNotification(payload.message || fallbackBody, url);
      } catch { /* ignore */ }
    };

    const handleResolutionDue = (data: { payload?: string }) => {
      fetchUnreadCount();
      let title = "Resolution required";
      let url: string | undefined = "/dashboard?tab=my_markets";
      try {
        const payload = JSON.parse(data?.payload ?? "{}");
        if (payload.market_title) title = `Resolve: ${payload.market_title}`;
        if (payload.market_id) url = `/markets/${payload.market_id}`;
      } catch { /* ignore */ }
      showBrowserNotification(title, url);
    };

    socket.on("notification:friend_request", handler);
    socket.on("notification:friend_accepted", handler);
    socket.on("notification:friend_removed", handler);
    socket.on("notification:new_message", handler);
    const handleBetResolved = (d: { payload?: string }) => handleWithMarketLink(d, "Your bet was resolved");
    const handleBetDisputed = (d: { payload?: string }) => handleWithMarketLink(d, "A dispute was opened");
    socket.on("notification:bet_resolved", handleBetResolved);
    socket.on("notification:bet_disputed", handleBetDisputed);
    socket.on("notification:resolution_due", handleResolutionDue);

    return () => {
      socket.off("notification:friend_request", handler);
      socket.off("notification:friend_accepted", handler);
      socket.off("notification:friend_removed", handler);
      socket.off("notification:new_message", handler);
      socket.off("notification:bet_resolved", handleBetResolved);
      socket.off("notification:bet_disputed", handleBetDisputed);
      socket.off("notification:resolution_due", handleResolutionDue);
    };
  }, [socket, fetchUnreadCount, router]);

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (isOpen) fetch();
  }, [isOpen, fetch]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [close]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={toggle}
        className="relative p-1 text-gray-600 hover:text-gray-900 transition-colors"
        aria-label="Notifications"
      >
        {/* Bell icon (SVG) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-xs text-blue-600 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-500">
                No notifications
              </p>
            )}
            {notifications.map((notif) => {
              const data = parsePayload(notif.payload);
              return (
                <button
                  key={notif.id}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    !notif.is_read ? "bg-blue-50" : ""
                  }`}
                  onClick={() => {
                    if (!notif.is_read) markAsRead([notif.id]);
                    const link = getNotificationLink(notif.type, data);
                    if (link) {
                      close();
                      if (notif.type === "friend_request") {
                        window.dispatchEvent(new CustomEvent("friends:open-tab", { detail: "received" }));
                      }
                      router.push(link);
                    }
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-500">
                      {TYPE_LABELS[notif.type] || notif.type}
                    </p>
                    <p className="text-sm text-gray-800 truncate">
                      {data.message || "New notification"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(notif.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!notif.is_read && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
