import { create } from "zustand";
import { io, Socket } from "socket.io-client";

interface SocketStore {
  socket: Socket | null;
  connect: () => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketStore>()((set, get) => ({
  socket: null,

  connect: () => {
    if (get().socket?.connected) return; // idempotent — no-op if already connected
    const socket = io(
      process.env.NEXT_PUBLIC_API_URL ?? "https://localhost:8443",
      {
        withCredentials: true, // sends httpOnly access_token cookie (per D-04)
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      }
    );
    set({ socket });
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null });
  },
}));
