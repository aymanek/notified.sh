import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("GET /health", () => {
  it("returns 200 with ok shape", async () => {
    const res = await SELF.fetch("https://notified.sh/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(typeof body.version).toBe("string");
    expect(typeof body.git_sha).toBe("string");
  });

  it("sets Content-Type: application/json", async () => {
    const res = await SELF.fetch("https://notified.sh/health");
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});

describe("404 handler", () => {
  it("returns 404 JSON for unknown routes", async () => {
    const res = await SELF.fetch("https://notified.sh/does-not-exist");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });
});
