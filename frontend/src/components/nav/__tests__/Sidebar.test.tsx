import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = jest.fn();
let pathname = "/markets";
const logout = jest.fn();
const toggle = jest.fn();
const setLocale = jest.fn();
let isAuthenticated = true;

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));
jest.mock("@/components/NotificationBell", () => () => <button>Notifications</button>);
jest.mock("@/components/UserSearch", () => () => <input aria-label="User search" />);
jest.mock("@/i18n", () => ({ useT: () => (key: string) => key }));
jest.mock("@/store/auth", () => ({
  useAuthStore: () => ({
    isAuthenticated,
    user: { id: "u1", username: "alice", bp: 3.5, lp: 2, tp: 1.25 },
    logout,
  }),
}));
jest.mock("@/store/theme", () => ({
  useThemeStore: () => ({ theme: "dark", toggle }),
}));
jest.mock("@/store/friends", () => ({
  useFriendsStore: (selector: (state: { pendingReceived: Array<{ id: string }> }) => unknown) =>
    selector({ pendingReceived: [{ id: "r1" }] }),
}));
jest.mock("@/store/locale", () => ({
  useLocaleStore: (selector: (state: { locale: string; setLocale: typeof setLocale }) => unknown) =>
    selector({ locale: "en", setLocale }),
}));

import Sidebar from "../Sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isAuthenticated = true;
    pathname = "/markets";
  });

  it("renders nothing for anonymous users", () => {
    isAuthenticated = false;
    const { container } = render(<Sidebar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders authenticated navigation, balances, active link, and pending badge", () => {
    render(<Sidebar />);

    expect(screen.getByText("@alice")).toHaveAttribute("href", "/profile/alice");
    expect(screen.getByText("❤️ 2")).toBeInTheDocument();
    expect(screen.getByText("3.5 BP")).toBeInTheDocument();
    expect(screen.getByText("1.3 TP")).toBeInTheDocument();
    expect(screen.getByText("nav.markets").closest("a")).toHaveClass("font-semibold");
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("wires theme, locale, and logout actions", async () => {
    logout.mockResolvedValueOnce(undefined);
    render(<Sidebar />);

    await userEvent.selectOptions(screen.getByLabelText("nav.language"), "fr");
    expect(setLocale).toHaveBeenCalledWith("fr");

    await userEvent.click(screen.getByTitle("nav.theme_light"));
    expect(toggle).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: /nav.logout/ }));
    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith("/login");
    });
  });
});
