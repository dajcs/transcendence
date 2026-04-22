import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type AuthState = {
  isAuthenticated: boolean;
  user: null | { username: string; bp: number; lp: number; tp: number };
  logout: jest.Mock<Promise<void>, []>;
};

let authState: AuthState = {
  isAuthenticated: false,
  user: null,
  logout: jest.fn().mockResolvedValue(undefined),
};

let friendsState = { pendingReceived: [] as Array<{ id: string }> };
let themeState = { theme: "light", toggle: jest.fn() };
let localeState = { locale: "en", setLocale: jest.fn() };
const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

jest.mock("@/i18n", () => ({ useT: () => (key: string) => key }));

jest.mock("@/store/auth", () => ({
  useAuthStore: (selector?: (state: AuthState) => unknown) =>
    typeof selector === "function" ? selector(authState) : authState,
}));

jest.mock("@/store/friends", () => ({
  useFriendsStore: (selector: (state: typeof friendsState) => unknown) => selector(friendsState),
}));

jest.mock("@/store/theme", () => ({
  useThemeStore: () => themeState,
}));

jest.mock("@/store/locale", () => ({
  useLocaleStore: (selector: (state: typeof localeState) => unknown) => selector(localeState),
}));

jest.mock("@/components/NotificationBell", () => () => <div data-testid="notification-bell">Bell</div>);
jest.mock("@/components/UserSearch", () => () => <div data-testid="user-search">Search</div>);

import TopNav from "../TopNav";

describe("TopNav", () => {
  beforeEach(() => {
    authState = {
      isAuthenticated: false,
      user: null,
      logout: jest.fn().mockResolvedValue(undefined),
    };
    friendsState = { pendingReceived: [] };
    themeState = { theme: "light", toggle: jest.fn() };
    localeState = { locale: "en", setLocale: jest.fn() };
    jest.clearAllMocks();
  });

  it("shows public navigation when the user is signed out", () => {
    render(<TopNav />);

    expect(screen.getByRole("link", { name: "nav.login" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "nav.signup" })).toHaveAttribute("href", "/register");
    expect(screen.queryByTestId("notification-bell")).not.toBeInTheDocument();
  });

  it("renders authenticated links, balances, and pending friend count", async () => {
    authState = {
      isAuthenticated: true,
      user: { username: "alice", bp: 12.3, lp: 7, tp: 4.5 },
      logout: jest.fn().mockResolvedValue(undefined),
    };
    friendsState = { pendingReceived: [{ id: "1" }, { id: "2" }] };

    const view = render(<TopNav />);

    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
    expect(screen.getAllByText("@alice")[0]).toBeInTheDocument();
    expect(view.container.textContent).toContain("BP");
    expect(view.container.textContent).toContain("12.3");
    expect(view.container.textContent).toContain("TP");
    expect(view.container.textContent).toContain("4.5");
    expect(screen.getAllByText("2")[0]).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "nav.markets" })).toHaveAttribute("href", "/markets");
    expect(screen.getByRole("link", { name: "nav.hall_of_fame" })).toHaveAttribute("href", "/hall-of-fame");

    await userEvent.selectOptions(screen.getByLabelText("nav.language"), "fr");
    expect(localeState.setLocale).toHaveBeenCalledWith("fr");
  });

  it("logs out and redirects home from the desktop menu", async () => {
    authState = {
      isAuthenticated: true,
      user: { username: "alice", bp: 1, lp: 0, tp: 0 },
      logout: jest.fn().mockResolvedValue(undefined),
    };

    render(<TopNav />);

    await userEvent.click(screen.getAllByRole("button", { name: "nav.logout" })[0]);

    await waitFor(() => {
      expect(authState.logout).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith("/");
    });
  });
});
