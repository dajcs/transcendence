import { render, screen } from "@testing-library/react";

let isAuthenticated = false;

jest.mock("@/store/auth", () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated }),
}));

import AppShell from "../AppShell";

describe("AppShell", () => {
  beforeEach(() => {
    isAuthenticated = false;
  });

  it("does not reserve mobile top-bar space for anonymous routes", () => {
    render(<AppShell>Login page</AppShell>);

    const main = screen.getByRole("main");
    expect(main).toHaveClass("pt-8");
    expect(main).not.toHaveClass("pt-14");
  });

  it("reserves mobile top-bar space for authenticated routes", () => {
    isAuthenticated = true;
    render(<AppShell>Markets page</AppShell>);

    const main = screen.getByRole("main");
    expect(main).toHaveClass("pt-14");
    expect(main).toHaveClass("md:pt-8");
  });
});
