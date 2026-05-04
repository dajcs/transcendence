import { render, screen } from "@testing-library/react";

import Avatar from "../Avatar";

describe("Avatar", () => {
  it("renders uploaded avatar images when an avatar URL exists", () => {
    render(<Avatar username="alice" avatarUrl="/uploads/avatars/alice.png" />);

    expect(screen.getByRole("img", { name: "alice" })).toHaveAttribute(
      "src",
      "/uploads/avatars/alice.png",
    );
  });

  it("falls back to a deterministic initial when no avatar URL exists", () => {
    render(<Avatar username="bob" avatarUrl={null} />);

    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
