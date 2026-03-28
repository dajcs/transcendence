"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useChatStore } from "@/store/chat";
import { useAuthStore } from "@/store/auth";
import { useSocketStore } from "@/store/socket";

export default function ChatConversationPage() {
  const params = useParams<{ userId: string }>();
  const partnerId = params.userId;
  const { user: currentUser } = useAuthStore();
  const { messages, isLoading, fetchMessages, sendMessage, markRead } = useChatStore();
  const socket = useSocketStore((s) => s.socket);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial load (REST)
  useEffect(() => {
    fetchMessages(partnerId);
    markRead(partnerId);
  }, [partnerId, fetchMessages, markRead]);

  // Socket listener for incoming messages (replaces 3s poll per D-11)
  useEffect(() => {
    if (!socket) return;

    const handler = (_data: { from_user_id: string; from_username: string; content: string; sent_at: string }) => {
      // Refetch the full conversation so the message renders correctly
      fetchMessages(partnerId);
      markRead(partnerId);
    };

    socket.on("chat:message", handler);
    return () => {
      socket.off("chat:message", handler);
    };
  }, [socket, partnerId, fetchMessages, markRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const partnerUsername = messages.length > 0
    ? (messages[0].from_user_id === partnerId
        ? messages[0].from_username
        : messages[0].to_username)
    : "";

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage(partnerId, newMessage.trim());
      setNewMessage("");
    } catch {
      // show error inline
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4 mb-4">
        <Link href="/chat" className="text-gray-500 hover:text-gray-700">
          &larr;
        </Link>
        <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-gray-700">
          {partnerUsername ? partnerUsername[0].toUpperCase() : "?"}
        </div>
        {partnerUsername ? (
          <Link
            href={`/profile/${encodeURIComponent(partnerUsername)}`}
            className="font-medium text-gray-900 hover:text-blue-600"
          >
            {partnerUsername}
          </Link>
        ) : (
          <span className="font-medium text-gray-400">Loading...</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {isLoading && messages.length === 0 && (
          <p className="text-sm text-gray-500 text-center">Loading messages...</p>
        )}

        {!isLoading && messages.length === 0 && (
          <p className="text-sm text-gray-500 text-center">
            No messages yet. Say hello!
          </p>
        )}

        {messages.map((msg) => {
          const isMe = msg.from_user_id === currentUser?.id;
          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  isMe
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    isMe ? "text-blue-200" : "text-gray-500"
                  }`}
                >
                  {new Date(msg.sent_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {isMe && msg.read_at && " · Read"}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="mt-4 flex gap-2 border-t border-gray-200 pt-4">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          maxLength={2000}
          className="flex-1 rounded border border-gray-300 px-4 py-2 text-sm focus:border-blue-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {sending ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
