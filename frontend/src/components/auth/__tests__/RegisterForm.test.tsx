import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("@/lib/api", () => ({ api: { post: jest.fn() } }));
const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@/i18n", () => ({ useT: () => (key: string, params?: Record<string, number>) => `${key}${params?.n ?? ""}` }));

import RegisterForm from "../RegisterForm";
import { api } from "@/lib/api";

const post = api.post as jest.Mock;

describe("RegisterForm", () => {
  beforeEach(() => jest.clearAllMocks());

  function fields() {
    return {
      email: screen.getByLabelText("auth.email"),
      username: screen.getByLabelText("auth.username"),
      password: screen.getByLabelText("auth.password"),
    };
  }

  it("shows client validation errors before calling the API", async () => {
    render(<RegisterForm />);
    const form = fields();

    await userEvent.type(form.email, "bad-email");
    await userEvent.type(form.username, "ab");
    await userEvent.type(form.password, "Short1");
    await userEvent.click(screen.getByRole("button", { name: "auth.register" }));

    expect(await screen.findByText("auth.validation_invalid_email")).toBeInTheDocument();
    expect(screen.getByText("auth.validation_min_chars3")).toBeInTheDocument();
    expect(screen.getByText("auth.validation_min_chars8")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("submits valid registration and routes to login", async () => {
    post.mockResolvedValueOnce({ data: {} });
    render(<RegisterForm />);
    const form = fields();

    await userEvent.type(form.email, "new@example.com");
    await userEvent.type(form.username, "newuser");
    await userEvent.type(form.password, "Password1");
    await userEvent.click(screen.getByRole("button", { name: "auth.register" }));

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith("/api/auth/register", {
        email: "new@example.com",
        username: "newuser",
        password: "Password1",
      });
      expect(push).toHaveBeenCalledWith("/login?registered=1");
    });
  });

  it("renders backend validation detail from array responses", async () => {
    post.mockRejectedValueOnce({ response: { data: { detail: [{ msg: "Email already exists" }] } } });
    render(<RegisterForm />);
    const form = fields();

    await userEvent.type(form.email, "used@example.com");
    await userEvent.type(form.username, "useduser");
    await userEvent.type(form.password, "Password1");
    await userEvent.click(screen.getByRole("button", { name: "auth.register" }));

    expect(await screen.findByText("Email already exists")).toBeInTheDocument();
  });
});
