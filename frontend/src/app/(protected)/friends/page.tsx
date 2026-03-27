"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFriendsStore } from "@/store/friends";

export default function FriendsPage() {
  const {
    friends,
    pendingReceived,
    pendingSent,
    isLoading,
    fetch,
    acceptRequest,
    rejectRequest,
    removeFriend,
    blockUser,
  } = useFriendsStore();

  const [activeTab, setActiveTab] = useState<"friends" | "received" | "sent">("friends");

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Friends</h1>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("friends")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "friends"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Friends ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab("received")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "received"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Requests ({pendingReceived.length})
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
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Sent ({pendingSent.length})
        </button>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}

      {/* Friends list */}
      {activeTab === "friends" && (
        <div className="space-y-2">
          {friends.length === 0 && !isLoading && (
            <p className="text-sm text-gray-500">No friends yet. Search for users to send requests!</p>
          )}
          {friends.map((friend) => (
            <div
              key={friend.user_id}
              className="flex items-center justify-between rounded border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-gray-700">
                    {friend.username[0].toUpperCase()}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                      friend.is_online ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <Link
                    href={`/profile/${friend.username}`}
                    className="font-medium text-gray-900 hover:text-blue-600"
                  >
                    {friend.username}
                  </Link>
                  <p className="text-xs text-gray-500">
                    Friends since {new Date(friend.since).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/chat/${friend.user_id}`}
                  className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Message
                </Link>
                <button
                  onClick={() => removeFriend(friend.user_id)}
                  className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                >
                  Remove
                </button>
                <button
                  onClick={() => blockUser(friend.user_id)}
                  className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-500 hover:bg-gray-50"
                >
                  Block
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
            <p className="text-sm text-gray-500">No pending friend requests.</p>
          )}
          {pendingReceived.map((req) => (
            <div
              key={req.id}
              className="flex items-center justify-between rounded border border-yellow-200 bg-yellow-50 p-4"
            >
              <div>
                <Link
                  href={`/profile/${req.from_username}`}
                  className="font-medium text-gray-900 hover:text-blue-600"
                >
                  {req.from_username}
                </Link>
                <p className="text-xs text-gray-500">
                  Sent {new Date(req.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => acceptRequest(req.id)}
                  className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                >
                  Accept
                </button>
                <button
                  onClick={() => rejectRequest(req.id)}
                  className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending sent */}
      {activeTab === "sent" && (
        <div className="space-y-2">
          {pendingSent.length === 0 && !isLoading && (
            <p className="text-sm text-gray-500">No pending sent requests.</p>
          )}
          {pendingSent.map((req) => (
            <div
              key={req.id}
              className="flex items-center justify-between rounded border border-gray-200 bg-white p-4"
            >
              <div>
                <Link
                  href={`/profile/${req.to_username}`}
                  className="font-medium text-gray-900 hover:text-blue-600"
                >
                  {req.to_username}
                </Link>
                <p className="text-xs text-gray-500">
                  Sent {new Date(req.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">Pending</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
