"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useT } from "@/i18n";

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
  const t = useT();

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
      {profileQuery.isLoading && <p className="text-sm text-gray-500 dark:text-gray-400">{t("profile.loading")}</p>}
      {profileQuery.isError && <p className="text-sm text-red-600">{t("profile.not_found")}</p>}

      {profile && (
        <>
          {/* Profile header */}
          <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="h-20 w-20 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-2xl font-bold text-gray-700 dark:text-gray-300">
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
                  {isOwnProfile && (
                    <Link
                      href="/settings"
                      title={t("profile.settings")}
                      className="rounded border border-gray-200 dark:border-gray-700 p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                      aria-label="Settings"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </Link>
                  )}
                  {!isOwnProfile && (
                    <div className="flex gap-2">
                      {profile.friendship_status === "accepted" && (
                        <span className="rounded bg-green-100 dark:bg-green-900/20 px-3 py-1 text-sm text-green-700 dark:text-green-400">
                          {t("profile.friends")}
                        </span>
                      )}
                      {profile.friendship_status === "pending" && (
                        <span className="rounded bg-yellow-100 dark:bg-yellow-900/20 px-3 py-1 text-sm text-yellow-700 dark:text-yellow-400">
                          {t("profile.request_pending")}
                        </span>
                      )}
                      {!profile.friendship_status && (
                        <button
                          onClick={() => sendFriendRequest.mutate(profile.id)}
                          disabled={sendFriendRequest.isPending}
                          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {t("profile.add_friend")}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t("profile.joined")} {new Date(profile.created_at).toLocaleDateString()}
                </p>

                {/* Bio */}
                {editing ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={500}
                      rows={3}
                      className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder={t("profile.bio_placeholder")}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateProfile.mutate({ bio })}
                        disabled={updateProfile.isPending}
                        className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                      >
                        {t("common.save")}
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setBio(profile.bio || "");
                        }}
                        className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm text-gray-700 dark:text-gray-300"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {profile.bio || (isOwnProfile ? t("profile.no_bio") : "")}
                    </p>
                    {isOwnProfile && (
                      <button
                        onClick={() => setEditing(true)}
                        className="mt-1 text-xs text-blue-600 hover:underline"
                      >
                        {profile.bio ? t("profile.edit_bio") : t("profile.add_bio")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{profile.kp}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("profile.karma_points")}</p>
            </div>
            <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{profile.tp}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("profile.truth_points")}</p>
            </div>
            <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{profile.total_bets}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("profile.total_bets")}</p>
            </div>
            <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{profile.win_rate}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("profile.win_rate")}</p>
            </div>
          </div>

          {sendFriendRequest.isError && (
            <p className="text-sm text-red-600">{t("profile.friend_error")}</p>
          )}
        </>
      )}
    </div>
  );
}
