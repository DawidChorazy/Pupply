import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";

import { env } from "./config/env";
import { openApiSpec } from "./docs/openapi";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { apiRouter } from "./routes";

const app = express();

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
app.use(
  cors({
    origin: corsOrigin,
    credentials: true
  })
);
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json());

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

app.get("/openapi.json", (_req, res) => {
  res.status(200).json(openApiSpec);
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
