import { Prisma } from "@prisma/client";
import { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

import { AppError } from "../utils/app-error";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "Route not found"
  });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: error.flatten().fieldErrors
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    res.status(409).json({
      error: "CONFLICT",
      message: "Resource already exists"
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: error.code,
      message: error.message
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "Unexpected server error"
  });
};
