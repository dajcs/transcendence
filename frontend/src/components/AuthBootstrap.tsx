"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { useFriendsStore } from "@/store/friends";
import { useSocketStore } from "@/store/socket";

export default function AuthBootstrap() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchFriends = useFriendsStore((s) => s.fetch);
  const connectSocket = useSocketStore((s) => s.connect);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchFriends();
      connectSocket(); // connect AFTER auth cookie is set (D-09, Pitfall 4)
    }
  }, [isAuthenticated, fetchFriends, connectSocket]);

  return null;
}
