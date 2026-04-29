"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useFriendsStore } from "@/store/friends";
import { useSocketStore } from "@/store/socket";

const PROTECTED_PATH_PREFIXES = ["/markets", "/friends", "/chat", "/profile", "/settings"];

export default function AuthBootstrap() {
  const pathname = usePathname();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const applyBalanceUpdate = useAuthStore((s) => s.applyBalanceUpdate);
  const fetchFriends = useFriendsStore((s) => s.fetch);
  const socket = useSocketStore((s) => s.socket);
  const connectSocket = useSocketStore((s) => s.connect);
  const disconnectSocket = useSocketStore((s) => s.disconnect);
  const shouldBootstrap = PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );

  useEffect(() => {
    if (shouldBootstrap) {
      bootstrap();
    }
  }, [bootstrap, shouldBootstrap]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchFriends();
      connectSocket(); // connect AFTER auth cookie is set (D-09, Pitfall 4)
    } else {
      disconnectSocket();
    }
  }, [isAuthenticated, fetchFriends, connectSocket, disconnectSocket]);

  useEffect(() => {
    if (!socket || !user) return;

    const handler = (payload: { user_id: string; bp: number; lp: number; tp: number }) => {
      if (payload.user_id === user.id) {
        applyBalanceUpdate(payload);
      }
    };

    socket.on("points:balance_changed", handler);
    return () => {
      socket.off("points:balance_changed", handler);
    };
  }, [socket, user, applyBalanceUpdate]);

  return null;
}
