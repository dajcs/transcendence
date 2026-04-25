import { render, waitFor } from "@testing-library/react";

type AuthState = {
  bootstrap: jest.Mock<Promise<void>, []>;
  isAuthenticated: boolean;
};

const bootstrap = jest.fn().mockResolvedValue(undefined);
const fetchFriends = jest.fn();
const connect = jest.fn();
const disconnect = jest.fn();
let pathname = "/markets";

let authState: AuthState = {
  bootstrap,
  isAuthenticated: true,
};

jest.mock("@/store/auth", () => ({
  useAuthStore: (selector: (state: AuthState) => unknown) => selector(authState),
}));

jest.mock("@/store/friends", () => ({
  useFriendsStore: (selector: (state: { fetch: typeof fetchFriends }) => unknown) =>
    selector({ fetch: fetchFriends }),
}));

jest.mock("@/store/socket", () => ({
  useSocketStore: (selector: (state: { connect: typeof connect; disconnect: typeof disconnect }) => unknown) =>
    selector({ connect, disconnect }),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

import AuthBootstrap from "../AuthBootstrap";

describe("AuthBootstrap", () => {
  beforeEach(() => {
    authState = { bootstrap, isAuthenticated: true };
    pathname = "/markets";
    jest.clearAllMocks();
  });

  it("disconnects the socket when authentication is lost", async () => {
    const view = render(<AuthBootstrap />);

    await waitFor(() => {
      expect(connect).toHaveBeenCalledTimes(1);
    });

    authState = { bootstrap, isAuthenticated: false };
    view.rerender(<AuthBootstrap />);

    await waitFor(() => {
      expect(disconnect).toHaveBeenCalledTimes(1);
    });
  });

  it("does not probe /api/auth/me on logged-out auth pages", () => {
    pathname = "/login";
    authState = { bootstrap, isAuthenticated: false };

    render(<AuthBootstrap />);

    expect(bootstrap).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
