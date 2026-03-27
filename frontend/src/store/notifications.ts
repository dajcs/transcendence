import { create } from "zustand";
import { api } from "@/lib/api";

export interface AppNotification {
  id: string;
  type: string;
  payload: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationStore {
  notifications: AppNotification[];
  unreadCount: number;
  isOpen: boolean;
  fetch: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (ids: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  toggle: () => void;
  close: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,

  fetch: async () => {
    try {
      const { data } = await api.get<{ items: AppNotification[]; unread_count: number }>(
        "/api/notifications"
      );
      set({ notifications: data.items, unreadCount: data.unread_count });
    } catch {
      // ignore
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { data } = await api.get<{ unread_count: number }>("/api/notifications/unread-count");
      set({ unreadCount: data.unread_count });
    } catch {
      // ignore
    }
  },

  markAsRead: async (ids: string[]) => {
    await api.post("/api/notifications/mark-read", { notification_ids: ids });
    set((state) => ({
      notifications: state.notifications.map((n) =>
        ids.includes(n.id) ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - ids.length),
    }));
  },

  markAllAsRead: async () => {
    await api.post("/api/notifications/mark-all-read");
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));
  },

  deleteNotification: async (id: string) => {
    await api.delete(`/api/notifications/${id}`);
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: state.notifications.find((n) => n.id === id && !n.is_read)
        ? state.unreadCount - 1
        : state.unreadCount,
    }));
  },

  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  close: () => set({ isOpen: false }),
}));
