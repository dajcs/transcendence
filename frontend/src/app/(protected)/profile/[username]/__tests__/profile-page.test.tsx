import { act, render, screen, waitFor } from "@testing-library/react";
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

let authState: { user: null | { username: string }; setAvatarUrl: jest.Mock } = {
  user: { username: "alice" },
  setAvatarUrl: jest.fn(),
};
jest.mock("@/store/auth", () => ({
  useAuthStore: (selector?: (state: typeof authState) => unknown) =>
    selector ? selector(authState) : authState,
}));

let socketHandlers: Record<string, (data: unknown) => void> = {};
const socketOn = jest.fn((event: string, handler: (data: unknown) => void) => {
  socketHandlers[event] = handler;
});
const socketOff = jest.fn((event: string) => {
  delete socketHandlers[event];
});
jest.mock("@/store/socket", () => ({
  useSocketStore: (selector: (state: { socket: { on: typeof socketOn; off: typeof socketOff } }) => unknown) =>
    selector({ socket: { on: socketOn, off: socketOff } }),
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
  mission: null,
  created_at: "2026-01-02T00:00:00.000Z",
  lp: 14,
  bp: 12.25,
  tp: 3.4,
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
    {
      id: "tx-2",
      date: "2026-01-03T12:00:00.000Z",
      type: "lp_allocation",
      description: "21 ❤️",
      market_id: null,
      market_title: null,
      bp_delta: 4.5,
      bp_balance: 10.0,
      tp_delta: 0,
      tp_balance: 2.0,
    },
  ],
  total: 2,
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
    if (url === "/api/bets/positions?user_id=user-1") {
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
    authState = { user: { username: "alice" }, setAvatarUrl: jest.fn() };
    socketHandlers = {};
    jest.clearAllMocks();
    setupApi();
  });

  it("shows own-profile controls and exposes the bets tab", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "alice" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "profile.settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByPlaceholderText("profile.add_mission")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "profile.accept_mission" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "profile.tab_points_own" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "profile.tab_bets_own" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "profile.tab_markets_own" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "profile.add_friend" })).not.toBeInTheDocument();
    expect(screen.getByText("❤️")).toHaveClass("text-gray-400");
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("BP")).toBeInTheDocument();
    expect(screen.getByText("12.3")).toBeInTheDocument();
    expect(screen.getByText("TP")).toBeInTheDocument();
    expect(screen.getByText("3.4")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("60.0%")).toBeInTheDocument();
    expect(await screen.findByText("21 ❤️")).toBeInTheDocument();
  });

  it("refreshes displayed LP when the viewed user's balance changes in realtime", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "alice" })).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();

    mockGet.mockImplementation((url: string) => {
      if (url === "/api/users/alice") {
        return Promise.resolve({ data: { ...profile, lp: 15 } });
      }
      if (url.startsWith("/api/users/alice/transactions")) {
        return Promise.resolve({ data: transactions });
      }
      if (url === "/api/bets/positions?user_id=user-1") {
        return Promise.resolve({ data: positions });
      }
      if (url.startsWith("/api/markets?proposer_id=user-1")) {
        return Promise.resolve({ data: markets });
      }
      throw new Error(`Unhandled GET ${url}`);
    });

    await act(async () => {
      socketHandlers["points:balance_changed"]?.({ user_id: "user-1", bp: 12.25, lp: 15, tp: 3.4 });
    });

    expect(await screen.findByText("15")).toBeInTheDocument();
  });

  it("accepts a new mission statement inline", async () => {
    renderPage();

    const missionInput = await screen.findByPlaceholderText("profile.add_mission");
    await userEvent.type(missionInput, "Predict carefully");

    await userEvent.click(screen.getByRole("button", { name: "profile.accept_mission" }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith("/api/users/me", { mission: "Predict carefully" });
    });
    expect(await screen.findByRole("button", { name: "Predict carefully" })).toHaveAttribute(
      "title",
      "profile.change_mission",
    );
    expect(screen.queryByPlaceholderText("profile.add_mission")).not.toBeInTheDocument();
  });

  it("uploads a custom avatar image from the own profile avatar", async () => {
    mockPost.mockResolvedValueOnce({ data: { ...profile, avatar_url: "/uploads/avatars/user-1.png" } });
    renderPage();

    const uploadControl = await screen.findByLabelText("Upload custom avatar image");
    expect(uploadControl).toHaveAttribute("title", "Upload custom avatar image");

    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    await userEvent.upload(screen.getByTestId("avatar-upload-input"), file);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/users/me/avatar",
        expect.any(FormData),
      );
    });
    expect(authState.setAvatarUrl).toHaveBeenCalledWith("/uploads/avatars/user-1.png");
    expect(await screen.findByRole("img", { name: "alice" })).toHaveAttribute(
      "src",
      "/uploads/avatars/user-1.png",
    );
  });

  it("turns an existing mission statement into an inline editor when clicked", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/users/alice") {
        return Promise.resolve({ data: { ...profile, mission: "Existing mission" } });
      }
      if (url.startsWith("/api/users/alice/transactions")) {
        return Promise.resolve({ data: transactions });
      }
      if (url === "/api/bets/positions?user_id=user-1") {
        return Promise.resolve({ data: positions });
      }
      if (url.startsWith("/api/markets?proposer_id=user-1")) {
        return Promise.resolve({ data: markets });
      }
      throw new Error(`Unhandled GET ${url}`);
    });

    renderPage();

    const mission = await screen.findByRole("button", { name: "Existing mission" });
    expect(mission).toHaveAttribute("title", "profile.change_mission");

    await userEvent.click(mission);

    expect(screen.getByDisplayValue("Existing mission")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "profile.accept_mission" })).not.toBeInTheDocument();
  });

  it("loads and renders the markets tab for the viewed profile", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "alice" });
    await userEvent.click(screen.getByRole("button", { name: "profile.tab_markets_own" }));

    expect(await screen.findByRole("link", { name: "Rain Market" })).toHaveAttribute(
      "href",
      "/markets/rain-market-market-1",
    );
    expect(mockGet).toHaveBeenCalledWith("/api/markets?proposer_id=user-1&limit=50&sort=newest");
  });

  it("shows friend actions for another user's profile and exposes their bets tab", async () => {
    params = { username: "bob" };
    authState = { user: { username: "alice" }, setAvatarUrl: jest.fn() };
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
      if (url === "/api/bets/positions?user_id=user-2") {
        return Promise.resolve({ data: positions });
      }
      throw new Error(`Unhandled GET ${url}`);
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "bob" })).toBeInTheDocument();
    expect(screen.getByText("profile.no_blurb")).toHaveClass("text-gray-400");
    expect(screen.getByRole("button", { name: 'profile.tab_points:{"username":"bob"}' })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: 'profile.tab_bets:{"username":"bob"}' })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: 'profile.tab_markets:{"username":"bob"}' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: 'profile.tab_bets:{"username":"bob"}' }));
    expect(await screen.findByRole("link", { name: "Rain Market" })).toHaveAttribute(
      "href",
      "/markets/rain-market-market-1",
    );
    expect(mockGet).toHaveBeenCalledWith("/api/bets/positions?user_id=user-2");

    await userEvent.click(screen.getByRole("button", { name: "profile.add_friend" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/api/friends/request/user-2");
    });
  });
});
