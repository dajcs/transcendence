import { create } from "zustand";
import { api } from "@/lib/api";
import type { BlockedUser, Friend, FriendListResponse, FriendRequest } from "@/lib/friends-types";

interface FriendsStore {
  friends: Friend[];
  pendingReceived: FriendRequest[];
  pendingSent: FriendRequest[];
  blocked: BlockedUser[];
  isLoading: boolean;
  fetch: () => Promise<void>;
  sendRequest: (userId: string) => Promise<string | null>;
  acceptRequest: (requestId: string) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
}

export const useFriendsStore = create<FriendsStore>()((set, get) => ({
  friends: [],
  pendingReceived: [],
  pendingSent: [],
  blocked: [],
  isLoading: false,

  fetch: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get<FriendListResponse>("/api/friends");
      set({
        friends: data.friends,
        pendingReceived: data.pending_received,
        pendingSent: data.pending_sent,
        blocked: data.blocked,
      });
    } catch {
      // ignore - user may not be logged in
    } finally {
      set({ isLoading: false });
    }
  },

  sendRequest: async (userId: string): Promise<string | null> => {
    try {
      const { data } = await api.post<{ success: boolean; detail?: string }>(
        `/api/friends/request/${userId}`
      );
      if (!data.success) {
        return data.detail ?? "Could not send request";
      }
      await get().fetch();
      return null;
    } catch {
      return "Could not send request";
    }
  },

  acceptRequest: async (requestId: string) => {
    await api.post(`/api/friends/accept/${requestId}`);
    await get().fetch();
  },

  cancelRequest: async (requestId: string) => {
    set((state) => ({ pendingSent: state.pendingSent.filter((r) => r.id !== requestId) }));
    try {
      await api.delete(`/api/friends/request/${requestId}`);
    } finally {
      await get().fetch();
    }
  },

  rejectRequest: async (requestId: string) => {
    await api.post(`/api/friends/reject/${requestId}`);
    await get().fetch();
  },

  removeFriend: async (userId: string) => {
    set((state) => ({ friends: state.friends.filter((f) => f.user_id !== userId) }));
    try {
      await api.delete(`/api/friends/${userId}`);
    } finally {
      await get().fetch();
    }
  },

  blockUser: async (userId: string) => {
    try {
      await api.post(`/api/friends/block/${userId}`);
    } finally {
      await get().fetch();
    }
  },

  unblockUser: async (userId: string) => {
    set((state) => ({ blocked: state.blocked.filter((u) => u.user_id !== userId) }));
    try {
      await api.post(`/api/friends/unblock/${userId}`);
    } finally {
      await get().fetch();
    }
  },
}));
