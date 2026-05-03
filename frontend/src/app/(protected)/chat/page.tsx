"use client";

import { useEffect } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { useChatStore } from "@/store/chat";
import { useT } from "@/i18n";

export default function ChatListPage() {
  const { conversations, fetchConversations } = useChatStore();
  const t = useT();

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  if (conversations.length === 0) {
    return (
      <p className="text-[13px] text-gray-400 dark:text-gray-500 py-6 text-center">
        {t("chat.no_conversations_hint")}
      </p>
    );
  }

  return (
    <div className="bg-white dark:bg-[oklch(18%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(22%_0.015_250)] rounded-[10px] overflow-hidden">
      {conversations.map((conv, i) => (
        <Link
          key={conv.user_id}
          href={`/chat/${conv.user_id}`}
          className={`flex items-center gap-2.5 px-3 py-2.5 hover:bg-[oklch(97%_0.008_264)] dark:hover:bg-[oklch(20%_0.015_250)] transition-colors duration-100 ${
            i < conversations.length - 1 ? "border-b border-gray-100 dark:border-[oklch(22%_0.015_250)]" : ""
          }`}
        >
          <Avatar username={conv.username} avatarUrl={conv.avatar_url} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{conv.username}</span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
                {new Date(conv.last_message_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">{conv.last_message}</p>
          </div>
          {conv.unread_count > 0 && (
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white shrink-0">
              {conv.unread_count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
