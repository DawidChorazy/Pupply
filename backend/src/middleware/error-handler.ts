import { Prisma } from "@prisma/client";
import { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

import { AppError } from "../utils/app-error";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "Route not found",
    requestId: req.requestId
  });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: error.flatten().fieldErrors,
      requestId: req.requestId
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    res.status(409).json({
      error: "CONFLICT",
      message: "Resource already exists",
      requestId: req.requestId
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    res.status(404).json({
      error: "NOT_FOUND",
      message: "Resource not found",
      requestId: req.requestId
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      requestId: req.requestId
    });
    return;
  }

  console.error(JSON.stringify({ event: "unhandled_error", requestId: req.requestId, error: String(error) }));
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "Unexpected server error",
    requestId: req.requestId
  });
};
