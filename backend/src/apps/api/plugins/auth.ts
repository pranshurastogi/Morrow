import plugin from "fastify-plugin";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { MorrowError } from "../../../common/errors";
import { getEnvironment } from "../../../config/env";

export const authPlugin = plugin(async (app) => {
  const env = getEnvironment();
  const jwks = env.AUTH_JWKS_URL
    ? createRemoteJWKSet(new URL(env.AUTH_JWKS_URL))
    : null;
  app.decorateRequest("principal");

  app.addHook("onRequest", async (request) => {
    if (!request.url.startsWith("/v1/")) return;

    const authorization = request.headers.authorization;
    if (authorization?.startsWith("Bearer ") && jwks) {
      const token = authorization.slice("Bearer ".length);
      const verified = await jwtVerify(token, jwks, {
        ...(env.AUTH_ISSUER ? { issuer: env.AUTH_ISSUER } : {}),
        ...(env.AUTH_AUDIENCE ? { audience: env.AUTH_AUDIENCE } : {}),
      });
      if (!verified.payload.sub) {
        throw new MorrowError({
          code: "UNAUTHENTICATED",
          message: "Token has no subject",
          statusCode: 401,
        });
      }
      request.principal = {
        userId: verified.payload.sub,
        ...(typeof verified.payload["email"] === "string"
          ? { email: verified.payload["email"] }
          : {}),
      };
      return;
    }

    if (env.NODE_ENV !== "production" && env.ALLOW_DEVELOPMENT_AUTH) {
      const userId = request.headers["x-morrow-user-id"];
      const email = request.headers["x-morrow-user-email"];
      request.principal = {
        userId: typeof userId === "string" ? userId : "morrow-local-user",
        email: typeof email === "string" ? email : "builder@example.com",
      };
      return;
    }

    throw new MorrowError({
      code: "UNAUTHENTICATED",
      message: "A valid bearer token is required",
      statusCode: 401,
    });
  });
});
