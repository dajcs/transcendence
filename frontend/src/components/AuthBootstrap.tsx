"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { useFriendsStore } from "@/store/friends";

export default function AuthBootstrap() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchFriends = useFriendsStore((s) => s.fetch);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (isAuthenticated) fetchFriends();
  }, [isAuthenticated, fetchFriends]);

  return null;
}
