const redirectMock = jest.fn((url: URL) => ({
  status: 307,
  headers: new Headers({ location: url.toString() }),
}));

const nextMock = jest.fn(() => ({
  status: 200,
  headers: new Headers({ "x-middleware-next": "1" }),
}));

jest.mock("next/server", () => ({
  NextResponse: {
    redirect: (url: URL) => redirectMock(url),
    next: () => nextMock(),
  },
}));

import { config, proxy } from "@/proxy";

type ProxyRequest = {
  cookies: {
    get: (name: string) => { name: string; value: string } | undefined;
  };
  nextUrl: {
    pathname: string;
  };
  url: string;
};

function makeRequest(pathname: string, cookieValue?: string): ProxyRequest {
  return {
    cookies: {
      get: (name: string) =>
        name === "access_token" && cookieValue
          ? { name: "access_token", value: cookieValue }
          : undefined,
    },
    nextUrl: { pathname },
    url: `https://voxpopuli.local${pathname}`,
  };
}

describe("frontend route proxy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects unauthenticated settings visits to login", () => {
    const response = proxy(makeRequest("/settings") as never);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://voxpopuli.local/login");
    expect(redirectMock).toHaveBeenCalledTimes(1);
  });

  it("allows authenticated settings visits through", () => {
    const response = proxy(makeRequest("/settings", "test-token") as never);

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
    expect(nextMock).toHaveBeenCalledTimes(1);
  });

  it("tracks settings in the protected route matcher", () => {
    expect(config.matcher).toContain("/settings/:path*");
  });
});
