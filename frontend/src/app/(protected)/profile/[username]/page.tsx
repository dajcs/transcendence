"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  kp: number;
  tp: number;
  total_bets: number;
  win_rate: number;
  is_friend: boolean;
  friendship_status: string | null;
}

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const isOwnProfile = currentUser?.username === params.username;

  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");

  const profileQuery = useQuery<Profile>({
    queryKey: ["profile", params.username],
    queryFn: async () => {
      const { data } = await api.get(`/api/users/${encodeURIComponent(params.username)}`);
      return data;
    },
  });

  const profile = profileQuery.data;

  useEffect(() => {
    if (profile && !editing) {
      setBio(profile.bio || "");
    }
  }, [profile?.bio, editing]);

  const updateProfile = useMutation({
    mutationFn: async (data: { bio?: string }) => api.put("/api/users/me", data),
    onSuccess: async () => {
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["profile", params.username] });
    },
  });

  const sendFriendRequest = useMutation({
    mutationFn: async (userId: string) => api.post(`/api/friends/request/${userId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile", params.username] });
    },
  });

  return (
    <div className="space-y-6">
      {profileQuery.isLoading && <p className="text-sm text-gray-500">Loading profile...</p>}
      {profileQuery.isError && <p className="text-sm text-red-600">Profile not found.</p>}

      {profile && (
        <>
          {/* Profile header */}
          <div className="rounded border border-gray-200 bg-white p-6">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="h-20 w-20 shrink-0 rounded-full bg-gray-300 flex items-center justify-center text-2xl font-bold text-gray-700">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  profile.username[0].toUpperCase()
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-bold">{profile.username}</h1>
                  {!isOwnProfile && (
                    <div className="flex gap-2">
                      {profile.friendship_status === "accepted" && (
                        <span className="rounded bg-green-100 px-3 py-1 text-sm text-green-700">
                          Friends
                        </span>
                      )}
                      {profile.friendship_status === "pending" && (
                        <span className="rounded bg-yellow-100 px-3 py-1 text-sm text-yellow-700">
                          Request Pending
                        </span>
                      )}
                      {!profile.friendship_status && (
                        <button
                          onClick={() => sendFriendRequest.mutate(profile.id)}
                          disabled={sendFriendRequest.isPending}
                          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Add Friend
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <p className="mt-1 text-sm text-gray-500">
                  Joined {new Date(profile.created_at).toLocaleDateString()}
                </p>

                {/* Bio */}
                {editing ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={500}
                      rows={3}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Write something about yourself..."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateProfile.mutate({ bio })}
                        disabled={updateProfile.isPending}
                        className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setBio(profile.bio || "");
                        }}
                        className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="text-sm text-gray-700">
                      {profile.bio || (isOwnProfile ? "No bio yet." : "")}
                    </p>
                    {isOwnProfile && (
                      <button
                        onClick={() => setEditing(true)}
                        className="mt-1 text-xs text-blue-600 hover:underline"
                      >
                        {profile.bio ? "Edit bio" : "Add bio"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{profile.kp}</p>
              <p className="text-xs text-gray-500">Karma Points</p>
            </div>
            <div className="rounded border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{profile.tp}</p>
              <p className="text-xs text-gray-500">Truth Points</p>
            </div>
            <div className="rounded border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{profile.total_bets}</p>
              <p className="text-xs text-gray-500">Total Bets</p>
            </div>
            <div className="rounded border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{profile.win_rate}%</p>
              <p className="text-xs text-gray-500">Win Rate</p>
            </div>
          </div>

          {sendFriendRequest.isError && (
            <p className="text-sm text-red-600">Could not send friend request.</p>
          )}
        </>
      )}
    </div>
  );
}
