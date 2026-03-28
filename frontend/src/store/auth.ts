import { create } from "zustand";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  bp: number;
  kp: number;
  tp: number;
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  isAuthenticated: false,

  bootstrap: async () => {
    try {
      const { data } = await api.get<User>("/api/auth/me");
      set({ user: data, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },

  logout: async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Ignore errors — clear state regardless
    }
    set({ user: null, isAuthenticated: false });
  },
}));
