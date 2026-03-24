"use client";

import { useAuthStore } from "@/store/auth";

export default function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      {user && (
        <p className="text-gray-600">
          Welcome, <span className="font-medium">{user.username}</span>!
        </p>
      )}
      <p className="text-gray-500 text-sm">Prediction markets coming in Phase 2.</p>
    </div>
  );
}
