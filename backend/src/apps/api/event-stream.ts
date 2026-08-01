export function eventStreamHeaders(input: {
  origin?: string;
  allowedOrigins: readonly string[];
}): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff",
  };

  if (input.origin && input.allowedOrigins.includes(input.origin)) {
    headers["Access-Control-Allow-Origin"] = input.origin;
    headers.Vary = "Origin";
  }

  return headers;
}
