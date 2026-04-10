import { describe, it, expect, vi, beforeEach } from "vitest";

// Each test gets a fresh caprover module so the token cache is reset.
// We also stub fetch before each import so the module's top-level constants
// (BASE, PASSWORD) are read with the correct env values from vitest.config.js.

function mockLoginResponse(token = "captain-token") {
  return { ok: true, json: async () => ({ data: { token } }) };
}

function mockApiResponse(data) {
  return { ok: true, json: async () => ({ data }) };
}

function mockErrorResponse(status = 500) {
  return { ok: false, status, json: async () => ({}) };
}

let caprover;
let fetchMock;

beforeEach(async () => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.resetModules();
  caprover = await import("../src/caprover.js");
});

describe("appExists", () => {
  it("returns false when app list is empty", async () => {
    fetchMock
      .mockResolvedValueOnce(mockLoginResponse())
      .mockResolvedValueOnce(mockApiResponse({ appDefinitions: [] }));

    expect(await caprover.appExists("myapp")).toBe(false);
  });

  it("returns true when app is in the list", async () => {
    fetchMock
      .mockResolvedValueOnce(mockLoginResponse())
      .mockResolvedValueOnce(
        mockApiResponse({ appDefinitions: [{ appName: "myapp" }, { appName: "other" }] })
      );

    expect(await caprover.appExists("myapp")).toBe(true);
  });
});

describe("token caching", () => {
  it("logs in only once for multiple API calls within 50 minutes", async () => {
    fetchMock.mockResolvedValue(
      mockApiResponse({ token: "cached-token", appDefinitions: [] })
    );
    // Override first call to be a real login response
    fetchMock
      .mockResolvedValueOnce(mockLoginResponse("cached-token"))
      .mockResolvedValue(mockApiResponse({ appDefinitions: [] }));

    await caprover.appExists("app1");
    await caprover.appExists("app2");

    const loginCalls = fetchMock.mock.calls.filter((c) =>
      c[0].includes("/api/v2/login")
    );
    expect(loginCalls).toHaveLength(1);
  });

  it("re-authenticates after the token expires (50 min)", async () => {
    vi.useFakeTimers();

    fetchMock
      .mockResolvedValueOnce(mockLoginResponse("token-1"))
      .mockResolvedValueOnce(mockApiResponse({ appDefinitions: [] }))
      .mockResolvedValueOnce(mockLoginResponse("token-2"))
      .mockResolvedValueOnce(mockApiResponse({ appDefinitions: [] }));

    await caprover.appExists("app1");
    vi.advanceTimersByTime(51 * 60 * 1000); // advance 51 minutes
    await caprover.appExists("app2");

    const loginCalls = fetchMock.mock.calls.filter((c) =>
      c[0].includes("/api/v2/login")
    );
    expect(loginCalls).toHaveLength(2);

    vi.useRealTimers();
  });
});

describe("uploadTarball", () => {
  it("sends a multipart POST with the correct headers", async () => {
    fetchMock
      .mockResolvedValueOnce(mockLoginResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await caprover.uploadTarball("myapp", Buffer.from("fake-tarball"));

    const [url, opts] = fetchMock.mock.calls[1];
    expect(url).toContain("appName=myapp");
    expect(opts.method).toBe("POST");
    expect(opts.headers["x-captain-auth"]).toBe("captain-token");
    expect(opts.body).toBeInstanceOf(FormData);
  });
});

describe("createApp", () => {
  it("POSTs to appDefinitions with the correct app name", async () => {
    fetchMock
      .mockResolvedValueOnce(mockLoginResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await caprover.createApp("alice-myrepo");

    const [url, opts] = fetchMock.mock.calls[1];
    expect(url).toContain("/user/apps/appDefinitions");
    expect(JSON.parse(opts.body).appName).toBe("alice-myrepo");
  });
});
