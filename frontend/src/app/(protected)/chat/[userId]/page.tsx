"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useChatStore } from "@/store/chat";
import { useAuthStore } from "@/store/auth";
import { useSocketStore } from "@/store/socket";
import { useT } from "@/i18n";

const AVATAR_HUES = [40, 145, 160, 205, 264, 270, 310, 25, 320, 180];

function avatarColor(username: string): string {
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return `oklch(56% 0.2 ${AVATAR_HUES[hash % AVATAR_HUES.length]})`;
}

export default function ChatConversationPage() {
  const params = useParams<{ userId: string }>();
  const partnerId = params.userId;
  const { user: currentUser } = useAuthStore();
  const { messages, isLoading, fetchMessages, sendMessage, markRead } = useChatStore();
  const socket = useSocketStore((s) => s.socket);
  const t = useT();
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages(partnerId);
    markRead(partnerId);
  }, [partnerId, fetchMessages, markRead]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      fetchMessages(partnerId);
      markRead(partnerId);
    };
    socket.on("chat:message", handler);
    return () => { socket.off("chat:message", handler); };
  }, [socket, partnerId, fetchMessages, markRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const partnerUsername = messages.length > 0
    ? (messages[0].from_user_id === partnerId ? messages[0].from_username : messages[0].to_username)
    : "";

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(partnerId, newMessage.trim());
      setNewMessage("");
    } catch {
      // inline error
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] md:h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 mb-3 border-b border-gray-100 dark:border-[oklch(22%_0.015_250)]">
        <Link
          href="/chat"
          className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors shrink-0"
          aria-label="Back"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </Link>
        {partnerUsername ? (
          <>
            <div
              style={{ background: avatarColor(partnerUsername) }}
              className="w-[26px] h-[26px] rounded-full shrink-0 flex items-center justify-center text-white font-bold text-[12px]"
            >
              {partnerUsername[0].toUpperCase()}
            </div>
            <Link
              href={`/profile/${encodeURIComponent(partnerUsername)}`}
              className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 hover:text-[var(--accent)] transition-colors"
            >
              {partnerUsername}
            </Link>
          </>
        ) : (
          <span className="text-[13px] text-gray-400 dark:text-gray-500">{t("common.loading")}</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {isLoading && messages.length === 0 && (
          <p className="text-[13px] text-gray-400 dark:text-gray-500 text-center py-4">{t("chat.loading")}</p>
        )}
        {!isLoading && messages.length === 0 && (
          <p className="text-[13px] text-gray-400 dark:text-gray-500 text-center py-4">{t("chat.say_hello")}</p>
        )}
        {messages.map((msg) => {
          const isMe = msg.from_user_id === currentUser?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[70%] rounded-lg px-3 py-2 ${
                  isMe
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[oklch(97%_0.005_250)] dark:bg-[oklch(20%_0.015_250)] text-gray-900 dark:text-gray-100"
                }`}
              >
                <p className="text-[13px] whitespace-pre-wrap break-words">{msg.content}</p>
                <p className={`text-[10px] mt-0.5 ${isMe ? "text-white/60" : "text-gray-400 dark:text-gray-500"}`}>
                  {new Date(msg.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {isMe && msg.read_at && ` · ${t("chat.read")}`}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="mt-3 flex gap-2 pt-3 border-t border-gray-100 dark:border-[oklch(22%_0.015_250)]"
      >
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={t("chat.type_message")}
          maxLength={2000}
          className="flex-1 px-3 py-2 rounded-lg text-[13px] bg-[oklch(97%_0.005_250)] dark:bg-[oklch(20%_0.015_250)] border border-[oklch(91%_0.006_250)] dark:border-[oklch(24%_0.015_250)] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-[var(--accent)] hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {sending ? "…" : t("chat.send")}
        </button>
      </form>
    </div>
  );
}
