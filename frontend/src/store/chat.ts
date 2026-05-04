import { create } from "zustand";
import { api } from "@/lib/api";

export interface ChatMessage {
  id: string;
  from_user_id: string;
  from_username: string;
  from_avatar_url: string | null;
  to_user_id: string;
  to_username: string;
  to_avatar_url: string | null;
  content: string;
  sent_at: string;
  read_at: string | null;
}

export interface Conversation {
  user_id: string;
  username: string;
  avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface ChatStore {
  conversations: Conversation[];
  messages: ChatMessage[];
  activePartnerId: string | null;
  isLoading: boolean;
  fetchConversations: () => Promise<void>;
  fetchMessages: (partnerId: string) => Promise<void>;
  sendMessage: (partnerId: string, content: string) => Promise<void>;
  markRead: (partnerId: string) => Promise<void>;
  setActivePartner: (partnerId: string | null) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  messages: [],
  activePartnerId: null,
  isLoading: false,

  fetchConversations: async () => {
    try {
      const { data } = await api.get<Conversation[]>("/api/chat/conversations");
      set({ conversations: data });
    } catch {
      // ignore
    }
  },

  fetchMessages: async (partnerId: string) => {
    const switching = get().activePartnerId !== partnerId;
    set({ isLoading: true, activePartnerId: partnerId, ...(switching ? { messages: [] } : {}) });
    try {
      const { data } = await api.get<ChatMessage[]>(`/api/chat/${partnerId}/messages`);
      if (get().activePartnerId === partnerId) {
        set({ messages: data });
      }
    } catch {
      if (get().activePartnerId === partnerId) {
        set({ messages: [] });
      }
    } finally {
      if (get().activePartnerId === partnerId) {
        set({ isLoading: false });
      }
    }
  },

  sendMessage: async (partnerId: string, content: string) => {
    const { data } = await api.post<ChatMessage>(`/api/chat/${partnerId}/messages`, { content });
    set((state) => ({
      messages: [...state.messages, data],
    }));
    // Refresh conversations to update last message
    await get().fetchConversations();
  },

  markRead: async (partnerId: string) => {
    try {
      await api.post(`/api/chat/${partnerId}/read`);
      // Update unread count locally
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.user_id === partnerId ? { ...c, unread_count: 0 } : c
        ),
        messages: state.messages.map((m) =>
          m.from_user_id === partnerId && !m.read_at
            ? { ...m, read_at: new Date().toISOString() }
            : m
        ),
      }));
    } catch {
      // ignore
    }
  },

  setActivePartner: (partnerId: string | null) => {
    set({ activePartnerId: partnerId });
  },
}));
