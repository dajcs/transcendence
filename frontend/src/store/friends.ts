import { create } from "zustand";
import { api } from "@/lib/api";
import type { Friend, FriendListResponse, FriendRequest } from "@/lib/friends-types";

interface FriendsStore {
  friends: Friend[];
  pendingReceived: FriendRequest[];
  pendingSent: FriendRequest[];
  isLoading: boolean;
  fetch: () => Promise<void>;
  sendRequest: (userId: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
}

export const useFriendsStore = create<FriendsStore>((set, get) => ({
  friends: [],
  pendingReceived: [],
  pendingSent: [],
  isLoading: false,

  fetch: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get<FriendListResponse>("/api/friends");
      set({
        friends: data.friends,
        pendingReceived: data.pending_received,
        pendingSent: data.pending_sent,
      });
    } catch {
      // ignore - user may not be logged in
    } finally {
      set({ isLoading: false });
    }
  },

  sendRequest: async (userId: string) => {
    await api.post(`/api/friends/request/${userId}`);
    await get().fetch();
  },

  acceptRequest: async (requestId: string) => {
    await api.post(`/api/friends/accept/${requestId}`);
    await get().fetch();
  },

  rejectRequest: async (requestId: string) => {
    await api.post(`/api/friends/reject/${requestId}`);
    await get().fetch();
  },

  removeFriend: async (userId: string) => {
    await api.delete(`/api/friends/${userId}`);
    await get().fetch();
  },

  blockUser: async (userId: string) => {
    await api.post(`/api/friends/block/${userId}`);
    await get().fetch();
  },

  unblockUser: async (userId: string) => {
    await api.post(`/api/friends/unblock/${userId}`);
    await get().fetch();
  },
}));
