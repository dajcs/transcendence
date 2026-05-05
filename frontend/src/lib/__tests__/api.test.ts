import { api } from "@/lib/api";

describe("api client", () => {
  it("does not force a default content type so multipart uploads can set a boundary", () => {
    expect(api.defaults.headers["Content-Type"]).toBeUndefined();
    expect(api.defaults.headers.common["Content-Type"]).toBeUndefined();
    expect(api.defaults.headers.post?.["Content-Type"]).toBeUndefined();
  });
});
