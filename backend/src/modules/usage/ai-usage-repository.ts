import { createHash } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { MorrowError } from "../../common/errors";
import { getEnvironment } from "../../config/env";
import { getDatabase } from "../../infrastructure/database/client";
import {
  calculateOpenAiCostMicroUsd,
  OPENAI_PRICING_SOURCE,
  OPENAI_PRICING_VERSION,
  reservationMicroUsdForModel,
  type OpenAiTokenUsage,
} from "./openai-pricing";

const RESERVATION_TTL_MINUTES = 10;

export type AiUsageOperation =
  | "product_observation"
  | "product_observation_escalation"
  | "candidate_visual_comparison"
  | "candidate_precision_comparison"
  | "catalog_query_embedding";

export interface AiUsageModelSummary extends OpenAiTokenUsage {
  model: string;
  requests: number;
  costMicroUsd: number;
}

export interface AiUsageSummary extends OpenAiTokenUsage {
  period: "lifetime";
  limitMicroUsd: number;
  usedMicroUsd: number;
  reservedMicroUsd: number;
  remainingMicroUsd: number;
  requests: number;
  canStartInspection: boolean;
  primaryModel: string;
  escalationModel: string;
  embeddingModel: string;
  pricingVersion: string;
  pricingSource: string;
  models: AiUsageModelSummary[];
}

interface ResponseUsageShape {
  input_tokens: number;
  input_tokens_details?: {
    cached_tokens?: number;
    cache_write_tokens?: number;
  };
  output_tokens: number;
  output_tokens_details?: { reasoning_tokens?: number };
  total_tokens: number;
}

interface EmbeddingUsageShape {
  prompt_tokens: number;
  total_tokens: number;
}

function budgetLimitMicroUsd(): number {
  return Math.round(getEnvironment().AI_USER_SPEND_LIMIT_USD * 1_000_000);
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function settleExpiredReservations(
  sql: Sql | TransactionSql,
  userId: string,
) {
  await sql`
    update ai_usage_events
    set status = 'SETTLED', actual_microusd = reserved_microusd,
      pricing_version = ${OPENAI_PRICING_VERSION},
      failure_code = 'SETTLEMENT_UNKNOWN', settled_at = now()
    where user_id = ${userId} and status = 'RESERVED' and expires_at <= now()
  `;
}

export function openAiSafetyIdentifier(userId: string): string {
  const digest = createHash("sha256").update(userId).digest("hex").slice(0, 56);
  return `morrow_${digest}`;
}

export async function getAiUsageSummary(
  userId: string,
  sql: Sql = getDatabase(),
): Promise<AiUsageSummary> {
  await settleExpiredReservations(sql, userId);
  const rows = await sql`
    select model,
      count(*) filter (where status = 'SETTLED')::int as requests,
      coalesce(sum(actual_microusd) filter (where status = 'SETTLED'), 0)::bigint as cost_microusd,
      coalesce(sum(reserved_microusd) filter (where status = 'RESERVED'), 0)::bigint as reserved_microusd,
      coalesce(sum(input_tokens) filter (where status = 'SETTLED'), 0)::bigint as input_tokens,
      coalesce(sum(cached_input_tokens) filter (where status = 'SETTLED'), 0)::bigint as cached_input_tokens,
      coalesce(sum(cache_write_input_tokens) filter (where status = 'SETTLED'), 0)::bigint as cache_write_input_tokens,
      coalesce(sum(output_tokens) filter (where status = 'SETTLED'), 0)::bigint as output_tokens,
      coalesce(sum(reasoning_output_tokens) filter (where status = 'SETTLED'), 0)::bigint as reasoning_output_tokens,
      coalesce(sum(total_tokens) filter (where status = 'SETTLED'), 0)::bigint as total_tokens
    from ai_usage_events
    where user_id = ${userId}
    group by model
    order by cost_microusd desc, model
  `;
  const models = rows.map((row) => ({
    model: String(row.model),
    requests: numberValue(row.requests),
    costMicroUsd: numberValue(row.cost_microusd),
    inputTokens: numberValue(row.input_tokens),
    cachedInputTokens: numberValue(row.cached_input_tokens),
    cacheWriteInputTokens: numberValue(row.cache_write_input_tokens),
    outputTokens: numberValue(row.output_tokens),
    reasoningOutputTokens: numberValue(row.reasoning_output_tokens),
    totalTokens: numberValue(row.total_tokens),
  }));
  const sum = (field: keyof AiUsageModelSummary) =>
    models.reduce((total, model) => total + numberValue(model[field]), 0);
  const usedMicroUsd = sum("costMicroUsd");
  const reservedMicroUsd = rows.reduce(
    (total, row) => total + numberValue(row.reserved_microusd),
    0,
  );
  const limitMicroUsd = budgetLimitMicroUsd();
  const remainingMicroUsd = Math.max(
    0,
    limitMicroUsd - usedMicroUsd - reservedMicroUsd,
  );
  const env = getEnvironment();
  return {
    period: "lifetime",
    limitMicroUsd,
    usedMicroUsd,
    reservedMicroUsd,
    remainingMicroUsd,
    requests: sum("requests"),
    inputTokens: sum("inputTokens"),
    cachedInputTokens: sum("cachedInputTokens"),
    cacheWriteInputTokens: sum("cacheWriteInputTokens"),
    outputTokens: sum("outputTokens"),
    reasoningOutputTokens: sum("reasoningOutputTokens"),
    totalTokens: sum("totalTokens"),
    canStartInspection:
      remainingMicroUsd >= reservationMicroUsdForModel(env.OPENAI_VISION_MODEL),
    primaryModel: env.OPENAI_VISION_MODEL,
    escalationModel: env.OPENAI_ESCALATION_MODEL,
    embeddingModel: env.OPENAI_EMBEDDING_MODEL,
    pricingVersion: OPENAI_PRICING_VERSION,
    pricingSource: OPENAI_PRICING_SOURCE,
    models,
  };
}

export async function assertAiBudgetCanStart(userId: string): Promise<void> {
  const summary = await getAiUsageSummary(userId);
  if (summary.canStartInspection) return;
  throw new MorrowError({
    code: "AI_BUDGET_EXCEEDED",
    message:
      "This account has reached its recognition allowance. Morrow did not start another inspection.",
    statusCode: 429,
    details: {
      limitMicroUsd: summary.limitMicroUsd,
      usedMicroUsd: summary.usedMicroUsd,
      reservedMicroUsd: summary.reservedMicroUsd,
      remainingMicroUsd: summary.remainingMicroUsd,
      period: summary.period,
    },
  });
}

async function reserveAiUsage(input: {
  userId: string;
  scanId: string | null;
  operation: AiUsageOperation;
  model: string;
}): Promise<string> {
  const sql = getDatabase();
  const reservationMicroUsd = reservationMicroUsdForModel(input.model);
  const limitMicroUsd = budgetLimitMicroUsd();
  return sql.begin(async (transaction) => {
    await transaction`
      select pg_advisory_xact_lock(hashtextextended(${input.userId}, 0))
    `;
    await settleExpiredReservations(transaction, input.userId);
    const [row] = await transaction`
      select coalesce(sum(
        case
          when status = 'SETTLED' then actual_microusd
          when status = 'RESERVED' then reserved_microusd
          else 0
        end
      ), 0)::bigint as committed_microusd
      from ai_usage_events where user_id = ${input.userId}
    `;
    const committedMicroUsd = numberValue(row?.committed_microusd);
    if (committedMicroUsd + reservationMicroUsd > limitMicroUsd) {
      throw new MorrowError({
        code: "AI_BUDGET_EXCEEDED",
        message:
          "This account has reached its recognition allowance. No additional model request was sent.",
        statusCode: 429,
        details: {
          limitMicroUsd,
          committedMicroUsd,
          requestedReservationMicroUsd: reservationMicroUsd,
          period: "lifetime",
        },
      });
    }
    const [reservation] = await transaction`
      insert into ai_usage_events (
        user_id, scan_id, operation, model, status, reserved_microusd, expires_at
      ) values (
        ${input.userId}, ${input.scanId}, ${input.operation}, ${input.model},
        'RESERVED', ${reservationMicroUsd},
        now() + (${RESERVATION_TTL_MINUTES} * interval '1 minute')
      ) returning id
    `;
    if (!reservation) throw new Error("AI usage reservation was not created");
    return String(reservation.id);
  });
}

async function settleAiUsage(input: {
  reservationId: string;
  providerResponseId?: string;
  model: string;
  usage: OpenAiTokenUsage;
}): Promise<void> {
  const actualMicroUsd = calculateOpenAiCostMicroUsd({
    model: input.model,
    usage: input.usage,
  });
  const sql = getDatabase();
  const rows = await sql`
    update ai_usage_events set
      status = 'SETTLED', provider_response_id = ${input.providerResponseId ?? null},
      actual_microusd = ${actualMicroUsd}, input_tokens = ${input.usage.inputTokens},
      cached_input_tokens = ${input.usage.cachedInputTokens ?? 0},
      cache_write_input_tokens = ${input.usage.cacheWriteInputTokens ?? 0},
      output_tokens = ${input.usage.outputTokens ?? 0},
      reasoning_output_tokens = ${input.usage.reasoningOutputTokens ?? 0},
      total_tokens = ${input.usage.totalTokens},
      pricing_version = ${OPENAI_PRICING_VERSION}, settled_at = now()
    where id = ${input.reservationId} and status = 'RESERVED'
    returning id
  `;
  if (rows.length !== 1)
    throw new Error("AI usage reservation was not settled");
}

async function releaseAiUsage(
  reservationId: string,
  error: unknown,
): Promise<void> {
  const failureCode =
    error && typeof error === "object" && "code" in error
      ? String(error.code).slice(0, 120)
      : error instanceof Error
        ? error.name.slice(0, 120)
        : "UNKNOWN";
  await getDatabase()`
    update ai_usage_events set status = 'RELEASED', failure_code = ${failureCode},
      settled_at = now()
    where id = ${reservationId} and status = 'RESERVED'
  `;
}

export async function meterOpenAiResponse<
  T extends {
    id: string;
    usage?: ResponseUsageShape | null;
  },
>(input: {
  userId: string;
  scanId: string | null;
  operation: AiUsageOperation;
  model: string;
  request: () => PromiseLike<T>;
}): Promise<T> {
  const reservationId = await reserveAiUsage(input);
  let response: T;
  try {
    response = await input.request();
  } catch (error) {
    await releaseAiUsage(reservationId, error).catch(() => undefined);
    throw error;
  }
  if (!response.usage) {
    throw new Error("OpenAI response did not include token usage");
  }
  await settleAiUsage({
    reservationId,
    providerResponseId: response.id,
    model: input.model,
    usage: {
      inputTokens: response.usage.input_tokens,
      cachedInputTokens:
        response.usage.input_tokens_details?.cached_tokens ?? 0,
      cacheWriteInputTokens:
        response.usage.input_tokens_details?.cache_write_tokens ?? 0,
      outputTokens: response.usage.output_tokens,
      reasoningOutputTokens:
        response.usage.output_tokens_details?.reasoning_tokens ?? 0,
      totalTokens: response.usage.total_tokens,
    },
  });
  return response;
}

export async function meterOpenAiEmbedding<
  T extends {
    model: string;
    usage: EmbeddingUsageShape;
  },
>(input: {
  userId: string;
  scanId: string | null;
  operation: AiUsageOperation;
  model: string;
  request: () => PromiseLike<T>;
}): Promise<T> {
  const reservationId = await reserveAiUsage(input);
  let response: T;
  try {
    response = await input.request();
  } catch (error) {
    await releaseAiUsage(reservationId, error).catch(() => undefined);
    throw error;
  }
  await settleAiUsage({
    reservationId,
    model: response.model || input.model,
    usage: {
      inputTokens: response.usage.prompt_tokens,
      outputTokens: 0,
      totalTokens: response.usage.total_tokens,
    },
  });
  return response;
}
