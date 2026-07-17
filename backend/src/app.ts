import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";

import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { openApiSpec } from "./docs/openapi";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { requestContext } from "./middleware/request-context";
import { apiRouter } from "./routes";

const app = express();

if (env.TRUST_PROXY_HOPS > 0) {
  app.set("trust proxy", env.TRUST_PROXY_HOPS);
}

const configuredOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigin: cors.CorsOptions["origin"] =
  env.NODE_ENV === "development" || configuredOrigins.includes("*")
    ? true
    : (requestOrigin, callback) => {
        if (!requestOrigin || configuredOrigins.includes(requestOrigin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin is not allowed by CORS"));
      };

app.use(helmet());
app.use(requestContext);
app.use(
  cors({
    origin: corsOrigin,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.status(200).json({
    name: "Pupply Backend API",
    status: "ok",
    docs: {
      health: "/api/health",
      swaggerUi: "/docs",
      openApiJson: "/openapi.json",
      login: "/api/auth/login",
      registerUser: "/api/auth/register/user",
      registerClinic: "/api/auth/register/clinic",
      me: "/api/users/me"
    }
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok"
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok"
  });
});

app.get("/api/ready", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ready" });
  } catch (_error) {
    res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database is not ready",
      requestId: req.requestId
    });
  }
});

app.get("/openapi.json", (_req, res) => {
  res.status(200).json(openApiSpec);
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
