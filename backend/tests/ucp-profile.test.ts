import { afterEach, describe, expect, test } from "bun:test";
import { createApp } from "../src/apps/api/app";

describe("UCP platform profile", () => {
  let app: Awaited<ReturnType<typeof createApp>> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  test("is publicly cacheable for Shopify capability negotiation", async () => {
    app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/.well-known/ucp",
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=3600");
    expect(response.json().ucp.version).toBe("2026-04-08");
  });
});
