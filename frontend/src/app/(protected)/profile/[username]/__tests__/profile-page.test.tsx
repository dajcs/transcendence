import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/lib/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));

let params = { username: "alice" };
jest.mock("next/navigation", () => ({
  useParams: () => params,
}));

jest.mock("@/i18n", () => ({
  useT: () => (key: string, vars?: Record<string, string | number>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

let authState: { user: null | { username: string } } = { user: { username: "alice" } };
jest.mock("@/store/auth", () => ({
  useAuthStore: (selector?: (state: typeof authState) => unknown) =>
    selector ? selector(authState) : authState,
}));

import { api } from "@/lib/api";
import ProfilePage from "../page";

const mockGet = api.get as jest.Mock;
const mockPost = api.post as jest.Mock;
const mockPut = api.put as jest.Mock;

const profile = {
  id: "user-1",
  username: "alice",
  avatar_url: null,
  bio: null,
  created_at: "2026-01-02T00:00:00.000Z",
  lp: 14,
  tp: 3,
  total_bets: 5,
  win_rate: 60,
  is_friend: false,
  friendship_status: null,
};

const transactions = {
  transactions: [
    {
      id: "tx-1",
      date: "2026-01-04T12:00:00.000Z",
      type: "bet_won",
      description: "",
      market_id: "market-1",
      market_title: "Rain Market",
      bp_delta: 2.5,
      bp_balance: 12.5,
      tp_delta: 1.0,
      tp_balance: 3.0,
    },
  ],
  total: 1,
};

const positions = {
  active: [
    {
      id: "pos-1",
      bet_id: "market-1",
      side: "yes",
      bp_staked: 3,
      placed_at: "2026-01-03T00:00:00.000Z",
      withdrawn_at: null,
      refund_bp: null,
      market_title: "Rain Market",
      market_status: "open",
      yes_pct: 60,
      no_pct: 40,
    },
  ],
  resolved: [],
};

const markets = {
  items: [
    {
      id: "market-1",
      title: "Rain Market",
      deadline: "2026-06-01T00:00:00.000Z",
      status: "open",
      position_count: 4,
    },
  ],
  total: 1,
  offset: 0,
  limit: 50,
};

function setupApi() {
  mockGet.mockImplementation((url: string) => {
    if (url === "/api/users/alice") {
      return Promise.resolve({ data: profile });
    }
    if (url.startsWith("/api/users/alice/transactions")) {
      return Promise.resolve({ data: transactions });
    }
    if (url === "/api/bets/positions") {
      return Promise.resolve({ data: positions });
    }
    if (url.startsWith("/api/markets?proposer_id=user-1")) {
      return Promise.resolve({ data: markets });
    }
    throw new Error(`Unhandled GET ${url}`);
  });
  mockPost.mockResolvedValue({ data: {} });
  mockPut.mockResolvedValue({ data: {} });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <ProfilePage />
    </QueryClientProvider>,
  );
}

describe("ProfilePage", () => {
  beforeEach(() => {
    params = { username: "alice" };
    authState = { user: { username: "alice" } };
    jest.clearAllMocks();
    setupApi();
  });

  it("shows own-profile controls and exposes the bets tab", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "alice" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByText("profile.no_bio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "profile.add_bio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /profile\.tab_bets/u })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "profile.add_friend" })).not.toBeInTheDocument();
  });

  it("loads and renders the markets tab for the viewed profile", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "alice" });
    await userEvent.click(screen.getByRole("button", { name: /profile\.tab_markets/u }));

    expect(await screen.findByRole("link", { name: "Rain Market" })).toHaveAttribute(
      "href",
      "/markets/market-1",
    );
    expect(mockGet).toHaveBeenCalledWith("/api/markets?proposer_id=user-1&limit=50&sort=newest");
  });

  it("shows friend actions for another user's profile and hides the bets tab", async () => {
    params = { username: "bob" };
    authState = { user: { username: "alice" } };
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/users/bob") {
        return Promise.resolve({
          data: { ...profile, id: "user-2", username: "bob" },
        });
      }
      if (url.startsWith("/api/users/bob/transactions")) {
        return Promise.resolve({ data: transactions });
      }
      if (url.startsWith("/api/markets?proposer_id=user-2")) {
        return Promise.resolve({ data: { ...markets, items: [] } });
      }
      throw new Error(`Unhandled GET ${url}`);
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "bob" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /profile\.tab_bets/u })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "profile.add_friend" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/api/friends/request/user-2");
    });
  });
});
