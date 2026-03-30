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
    const existing = get().socket;
    if (existing) {
      if (!existing.connected) existing.connect(); // reconnect without creating a second instance
      return;
    }
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
    const socket = get().socket;
    if (socket) {
      socket.disconnect();      // sends DISCONNECT packet + destroys namespace
      socket.io._close();       // force-closes the Manager/transport directly
    }
    set({ socket: null });
  },
}));
