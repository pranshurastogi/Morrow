import type { AppEnvironment } from "../../config/env";

export function isPravaSandboxConfigured(
  env: Pick<AppEnvironment, "PRAVA_API_URL" | "PRAVA_SECRET_KEY">,
): boolean {
  return (
    env.PRAVA_API_URL === "https://sandbox.api.prava.space" &&
    Boolean(env.PRAVA_SECRET_KEY?.startsWith("sk_test_"))
  );
}
