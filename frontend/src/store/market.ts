"use client";

import { create } from "zustand";

type SortOption = "deadline" | "active" | "newest";
type StatusFilter = "all" | "open" | "resolved";

interface MarketState {
  sort: SortOption;
  filter: StatusFilter;
  page: number;
  setSort: (sort: SortOption) => void;
  setFilter: (filter: StatusFilter) => void;
  setPage: (page: number) => void;
  reset: () => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  sort: "deadline",
  filter: "all",
  page: 1,
  setSort: (sort) => set({ sort, page: 1 }),
  setFilter: (filter) => set({ filter, page: 1 }),
  setPage: (page) => set({ page }),
  reset: () => set({ sort: "deadline", filter: "all", page: 1 }),
}));
