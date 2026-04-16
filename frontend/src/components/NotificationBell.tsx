"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useNotificationStore } from "@/store/notifications";
import { useSocketStore } from "@/store/socket";
import { useT } from "@/i18n";

function parsePayload(payload: string | null): { message?: string; bet_id?: string; market_id?: string } {
  if (!payload) return {};
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

function getNotificationLink(type: string, data: { bet_id?: string; market_id?: string }): string | null {
  if (type === "bet_resolved" || type === "bet_disputed" || type === "resolution_proposed") {
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

const TYPE_LABEL_KEYS: Record<string, string> = {
  friend_request: "notif.friend_request",
  friend_accepted: "notif.friend_accepted",
  friend_removed: "notif.friend_removed",
  new_message: "notif.new_message",
  bet_resolved: "notif.bet_resolved",
  bet_disputed: "notif.bet_disputed",
  resolution_proposed: "notif.resolution_proposed",
  resolution_due: "notif.resolution_due",
  kp_converted: "notif.kp_converted",
};

export default function NotificationBell() {
  const t = useT();
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

  const socket = useSocketStore((s) => s.socket);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");

  // Read current permission state on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifPermission("unsupported");
      return;
    }
    setNotifPermission(Notification.permission);
  }, []);

  const requestNotifPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    // Fire browser notifications for any unread resolution_due already in the list
    if (result === "granted") {
      const store = useNotificationStore.getState();
      store.notifications
        .filter((n) => !n.is_read && n.type === "resolution_due")
        .forEach((n) => {
          const p = parsePayload(n.payload);
          const url = p.market_id ? `/markets/${p.market_id}` : "/dashboard?tab=my_markets";
          const body = p.message ?? "A market needs your resolution";
          const notif = new Notification("Vox Populi", { body, icon: "/favicon.ico", requireInteraction: true });
          notif.onclick = () => { window.focus(); window.location.href = url; notif.close(); };
        });
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Socket listener for new notification events
  useEffect(() => {
    if (!socket) return;

    const showBrowserNotification = (body: string, url?: string) => {
      if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
      const n = new Notification("Vox Populi", { body, icon: "/favicon.ico", requireInteraction: true });
      n.onclick = () => {
        window.focus();
        markAllAsReadRef.current();
        if (url) window.location.href = url;
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
      let title = t("notif.resolution_required");
      let url: string | undefined = "/dashboard?tab=my_markets";
      try {
        const payload = JSON.parse(data?.payload ?? "{}");
        if (payload.market_title) title = t("notif.resolve_market", { title: payload.market_title });
        if (payload.market_id) url = `/markets/${payload.market_id}`;
      } catch { /* ignore */ }
      showBrowserNotification(title, url);
    };

    socket.on("notification:friend_request", handler);
    socket.on("notification:friend_accepted", handler);
    socket.on("notification:friend_removed", handler);
    socket.on("notification:new_message", handler);
    const handleBetResolved = (d: { payload?: string }) => handleWithMarketLink(d, t("notif.bet_resolved_body"));
    const handleBetDisputed = (d: { payload?: string }) => handleWithMarketLink(d, t("notif.dispute_opened_body"));
    const handleResolutionProposed = (d: { payload?: string }) => handleWithMarketLink(d, t("notif.resolution_proposed"));
    socket.on("notification:bet_resolved", handleBetResolved);
    socket.on("notification:bet_disputed", handleBetDisputed);
    socket.on("notification:resolution_proposed", handleResolutionProposed);
    socket.on("notification:resolution_due", handleResolutionDue);
    socket.on("notification:kp_converted", handler);

    return () => {
      socket.off("notification:friend_request", handler);
      socket.off("notification:friend_accepted", handler);
      socket.off("notification:friend_removed", handler);
      socket.off("notification:new_message", handler);
      socket.off("notification:bet_resolved", handleBetResolved);
      socket.off("notification:bet_disputed", handleBetDisputed);
      socket.off("notification:resolution_proposed", handleResolutionProposed);
      socket.off("notification:resolution_due", handleResolutionDue);
      socket.off("notification:kp_converted", handler);
    };
  }, [socket, fetchUnreadCount, t]);

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
        className="relative p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        aria-label="Notifications"
      >
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
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("notif.title")}</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-xs text-blue-600 hover:underline"
              >
                {t("notif.mark_all_read")}
              </button>
            )}
          </div>

          {/* Browser notification permission prompt */}
          {notifPermission === "default" && (
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">Enable browser notifications?</p>
              <button
                onClick={requestNotifPermission}
                className="text-xs px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 shrink-0"
              >
                Enable
              </button>
            </div>
          )}
          {notifPermission === "denied" && (
            <div className="border-b border-gray-100 dark:border-gray-700 px-4 py-2 bg-red-50 dark:bg-red-900/20">
              <p className="text-xs text-red-700 dark:text-red-300">Browser notifications blocked — allow in browser settings.</p>
            </div>
          )}

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {t("notif.no_notifications")}
              </p>
            )}
            {notifications.map((notif) => {
              const data = parsePayload(notif.payload);
              const link = getNotificationLink(notif.type, data);
              const itemClass = `w-full text-left flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                !notif.is_read ? "bg-blue-50 dark:bg-blue-900/20" : ""
              }`;
              const handleClick = () => {
                if (!notif.is_read) markAsRead([notif.id]).catch(() => {});
                if (notif.type === "friend_request") {
                  window.dispatchEvent(new CustomEvent("friends:open-tab", { detail: "received" }));
                }
                close();
              };
              const content = (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {TYPE_LABEL_KEYS[notif.type] ? t(TYPE_LABEL_KEYS[notif.type] as any) : notif.type}
                    </p>
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                      {data.message || t("notif.new")}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {new Date(notif.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!notif.is_read && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </>
              );

              if (link) {
                return (
                  <Link key={notif.id} href={link} onClick={handleClick} className={itemClass}>
                    {content}
                  </Link>
                );
              }
              return (
                <div key={notif.id} role="button" tabIndex={0} onClick={handleClick} className={itemClass}>
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
