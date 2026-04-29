import { render, waitFor } from "@testing-library/react";

let theme = "light";
let locale = "en";
jest.mock("@/store/theme", () => ({
  useThemeStore: (selector: (state: { theme: string }) => unknown) => selector({ theme }),
}));
jest.mock("@/store/locale", () => ({
  useLocaleStore: (selector: (state: { locale: string }) => unknown) => selector({ locale }),
}));

import ThemeProvider from "../ThemeProvider";

describe("ThemeProvider", () => {
  beforeEach(() => {
    document.documentElement.className = "";
    document.documentElement.lang = "";
    theme = "light";
    locale = "en";
  });

  it("syncs dark class and html language from stores", async () => {
    theme = "dark";
    locale = "fr";
    render(<ThemeProvider><span>child</span></ThemeProvider>);

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("dark");
      expect(document.documentElement.lang).toBe("fr");
    });
  });

  it("removes dark class for light theme", async () => {
    document.documentElement.classList.add("dark");
    render(<ThemeProvider><span>child</span></ThemeProvider>);
    await waitFor(() => expect(document.documentElement).not.toHaveClass("dark"));
  });
});
