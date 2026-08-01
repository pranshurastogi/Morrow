import { describe, expect, test } from "bun:test";
import { eventStreamHeaders } from "../src/apps/api/event-stream";

describe("scan event stream headers", () => {
  test("allows the configured frontend origin on a hijacked response", () => {
    const headers = eventStreamHeaders({
      origin: "https://morrow-red.vercel.app",
      allowedOrigins: ["https://morrow-red.vercel.app"],
    });

    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://morrow-red.vercel.app",
    );
    expect(headers.Vary).toBe("Origin");
    expect(headers["Content-Type"]).toBe("text/event-stream");
  });

  test("does not reflect an unconfigured origin", () => {
    const headers = eventStreamHeaders({
      origin: "https://untrusted.example",
      allowedOrigins: ["https://morrow-red.vercel.app"],
    });

    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});
