import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MorrowError } from "../../common/errors";
import { getEnvironment, type AppEnvironment } from "../../config/env";
import { getRedisConnection } from "../queue/connection";

const CHECKOUT_CAPABILITY_KEY = "runtime:capability:merchant-checkout";
const CHECKOUT_CAPABILITY_TTL_SECONDS = 90;
const CHECKOUT_CAPABILITY_REFRESH_MS = 30_000;

const checkoutCapabilitySchema = z.object({
  available: z.boolean(),
  workerId: z.string().uuid(),
  refreshedAt: z.string().datetime(),
  reason: z.enum(["available", "executor_not_configured"]),
});

export interface CheckoutCapability {
  available: boolean;
  message: string | null;
}

export function isCheckoutExecutorConfigured(
  env: Pick<
    AppEnvironment,
    "MERCHANT_CHECKOUT_EXECUTOR_URL" | "MERCHANT_CHECKOUT_EXECUTOR_SECRET"
  >,
): boolean {
  return Boolean(
    env.MERCHANT_CHECKOUT_EXECUTOR_URL && env.MERCHANT_CHECKOUT_EXECUTOR_SECRET,
  );
}

function unavailableCapability(): CheckoutCapability {
  return {
    available: false,
    message:
      "Merchant checkout is not connected yet. Morrow will not request card approval until it can verify the order.",
  };
}

function parseCheckoutCapability(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = checkoutCapabilitySchema.safeParse(
      JSON.parse(raw) as unknown,
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function getCheckoutCapability(): Promise<CheckoutCapability> {
  try {
    const state = parseCheckoutCapability(
      await getRedisConnection().get(CHECKOUT_CAPABILITY_KEY),
    );
    if (state?.available) return { available: true, message: null };
  } catch (error) {
    console.error(
      { error: error instanceof Error ? error.message : String(error) },
      "checkout capability read failed",
    );
  }
  return unavailableCapability();
}

export async function assertCheckoutExecutionAvailable(): Promise<void> {
  const capability = await getCheckoutCapability();
  if (!capability.available) {
    throw new MorrowError({
      code: "INTEGRATION_NOT_CONFIGURED",
      message: capability.message ?? "Merchant checkout is not available",
      statusCode: 503,
    });
  }
}

export async function startCheckoutCapabilityHeartbeat(): Promise<
  () => Promise<void>
> {
  const redis = getRedisConnection();
  const workerId = randomUUID();
  const available = isCheckoutExecutorConfigured(getEnvironment());
  let stopped = false;

  const publish = async () => {
    if (stopped) return;
    await redis.set(
      CHECKOUT_CAPABILITY_KEY,
      JSON.stringify({
        available,
        workerId,
        refreshedAt: new Date().toISOString(),
        reason: available ? "available" : "executor_not_configured",
      }),
      "EX",
      CHECKOUT_CAPABILITY_TTL_SECONDS,
    );
  };

  await publish();
  const timer = setInterval(() => {
    void publish().catch((error: unknown) => {
      console.error(
        { error: error instanceof Error ? error.message : String(error) },
        "checkout capability heartbeat failed",
      );
    });
  }, CHECKOUT_CAPABILITY_REFRESH_MS);
  timer.unref();

  return async () => {
    stopped = true;
    clearInterval(timer);
    const current = parseCheckoutCapability(
      await redis.get(CHECKOUT_CAPABILITY_KEY),
    );
    if (current?.workerId === workerId) {
      await redis.del(CHECKOUT_CAPABILITY_KEY);
    }
  };
}
