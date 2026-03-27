"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface UserResult {
  id: string;
  username: string;
  avatar_url: string | null;
}

export default function UserSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get<UserResult[]>(`/api/users/search?q=${encodeURIComponent(query)}`);
        setResults(data);
        setIsOpen(true);
      } catch {
        setResults([]);
      }
    }, 300); // debounce

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        placeholder="Search users..."
        className="rounded border border-gray-300 px-3 py-1.5 text-sm w-48 focus:border-blue-400 focus:outline-none"
      />
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 w-64 rounded border border-gray-200 bg-white shadow-lg">
          {results.map((user) => (
            <Link
              key={user.id}
              href={`/profile/${user.username}`}
              onClick={() => {
                setIsOpen(false);
                setQuery("");
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-700">
                {user.username[0].toUpperCase()}
              </div>
              <span>{user.username}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
