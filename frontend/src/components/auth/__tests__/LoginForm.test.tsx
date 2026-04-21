import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("@/lib/api", () => ({ api: { post: jest.fn() } }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));
jest.mock("@/i18n", () => ({ useT: () => (key: string) => key }));
jest.mock("@/store/auth", () => ({
  useAuthStore: (selector: (state: { bootstrap: jest.Mock }) => unknown) =>
    selector({ bootstrap: jest.fn() }),
}));

import LoginForm from "../LoginForm";
import { api } from "@/lib/api";

const mockPost = api.post as jest.Mock;

describe("LoginForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows field validation instead of throwing when password is cleared after a failed login", async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: { detail: "Invalid credentials" } },
    });

    render(<LoginForm />);

    const identifierInput = screen.getByPlaceholderText("auth.enter_email_or_username");
    const passwordInput = screen.getByPlaceholderText("auth.password");
    const submitButton = screen.getByRole("button", { name: "auth.login" });

    await userEvent.type(identifierInput, "demo");
    await userEvent.type(passwordInput, "wrong-password");
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });

    await userEvent.clear(passwordInput);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(screen.getByText("auth.validation_password_required")).toBeInTheDocument();
    });
  });
});
