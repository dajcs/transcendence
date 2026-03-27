"use client";

import { useEffect, useRef } from "react";
import { useNotificationStore } from "@/store/notifications";

function parsePayload(payload: string | null): { message?: string } {
  if (!payload) return {};
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

const TYPE_LABELS: Record<string, string> = {
  friend_request: "Friend Request",
  friend_accepted: "Friend Accepted",
  new_message: "New Message",
  bet_resolved: "Bet Resolved",
  bet_disputed: "Bet Disputed",
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

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Poll unread count every 10 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

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
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    !notif.is_read ? "bg-blue-50" : ""
                  }`}
                  onClick={() => {
                    if (!notif.is_read) markAsRead([notif.id]);
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
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
