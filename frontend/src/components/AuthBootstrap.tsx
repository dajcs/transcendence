"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";

export default function AuthBootstrap() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);
  return null;
}
