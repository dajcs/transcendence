"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useChatStore } from "@/store/chat";
import { useT } from "@/i18n";

export default function ChatListPage() {
  const { conversations, fetchConversations } = useChatStore();
  const t = useT();

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("chat.title")}</h1>

      {conversations.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("chat.no_conversations_hint")}
        </p>
      )}

      <div className="space-y-2">
        {conversations.map((conv) => (
          <Link
            key={conv.user_id}
            href={`/chat/${conv.user_id}`}
            className="flex items-center gap-3 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          >
            <div className="h-10 w-10 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300">
              {conv.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 dark:text-gray-100">{conv.username}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(conv.last_message_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{conv.last_message}</p>
            </div>
            {conv.unread_count > 0 && (
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-600 text-xs text-white font-bold">
                {conv.unread_count}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
