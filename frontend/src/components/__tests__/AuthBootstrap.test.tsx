import { render, waitFor } from "@testing-library/react";

type AuthState = {
  bootstrap: jest.Mock<Promise<void>, []>;
  isAuthenticated: boolean;
  user: null | { id: string; bp: number; lp: number; tp: number };
  applyBalanceUpdate: jest.Mock<void, [{ user_id: string; bp: number; lp: number; tp: number }]>;
};

const bootstrap = jest.fn().mockResolvedValue(undefined);
const applyBalanceUpdate = jest.fn();
const fetchFriends = jest.fn();
const connect = jest.fn();
const disconnect = jest.fn();
const socketOn = jest.fn();
const socketOff = jest.fn();
let pathname = "/markets";

let authState: AuthState = {
  bootstrap,
  isAuthenticated: true,
  user: { id: "user-1", bp: 10, lp: 2, tp: 0 },
  applyBalanceUpdate,
};

jest.mock("@/store/auth", () => ({
  useAuthStore: (selector: (state: AuthState) => unknown) => selector(authState),
}));

jest.mock("@/store/friends", () => ({
  useFriendsStore: (selector: (state: { fetch: typeof fetchFriends }) => unknown) =>
    selector({ fetch: fetchFriends }),
}));

jest.mock("@/store/socket", () => ({
  useSocketStore: (selector: (state: {
    connect: typeof connect;
    disconnect: typeof disconnect;
    socket: { on: typeof socketOn; off: typeof socketOff };
  }) => unknown) =>
    selector({ connect, disconnect, socket: { on: socketOn, off: socketOff } }),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

import AuthBootstrap from "../AuthBootstrap";

describe("AuthBootstrap", () => {
  beforeEach(() => {
    authState = {
      bootstrap,
      isAuthenticated: true,
      user: { id: "user-1", bp: 10, lp: 2, tp: 0 },
      applyBalanceUpdate,
    };
    pathname = "/markets";
    jest.clearAllMocks();
  });

  it("disconnects the socket when authentication is lost", async () => {
    const view = render(<AuthBootstrap />);

    await waitFor(() => {
      expect(connect).toHaveBeenCalledTimes(1);
    });

    authState = { bootstrap, isAuthenticated: false, user: null, applyBalanceUpdate };
    view.rerender(<AuthBootstrap />);

    await waitFor(() => {
      expect(disconnect).toHaveBeenCalledTimes(1);
    });
  });

  it("does not probe /api/auth/me on logged-out auth pages", () => {
    pathname = "/login";
    authState = { bootstrap, isAuthenticated: false, user: null, applyBalanceUpdate };

    render(<AuthBootstrap />);

    expect(bootstrap).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("applies realtime point balance updates for the current user", async () => {
    render(<AuthBootstrap />);

    await waitFor(() => {
      expect(socketOn).toHaveBeenCalledWith("points:balance_changed", expect.any(Function));
    });

    const handler = socketOn.mock.calls.find(([event]) => event === "points:balance_changed")?.[1];
    handler?.({ user_id: "user-1", bp: 10, lp: 3, tp: 0 });
    handler?.({ user_id: "user-2", bp: 10, lp: 9, tp: 0 });

    expect(applyBalanceUpdate).toHaveBeenCalledTimes(1);
    expect(applyBalanceUpdate).toHaveBeenCalledWith({ user_id: "user-1", bp: 10, lp: 3, tp: 0 });
  });
});
