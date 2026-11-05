import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { createReview } from "../services/review.service";
import { createReviewSchema } from "../validation/review.schemas";

import { requireAuth } from "../middleware/require-auth";
import { createBooking, createBookings, getBooking, getBookingOperation, listBookings, updateBookingStatus } from "../services/booking.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import { bookingOperationKeySchema, createBookingSchema, createBookingsSchema, listBookingsSchema, updateBookingStatusSchema } from "../validation/booking.schemas";

const bookingRouter = Router();
bookingRouter.use(requireAuth);
bookingRouter.post("/:bookingId/review", rateLimit({ windowMs: 60_000, limit: 10,
  keyGenerator: req => req.auth!.accountId, standardHeaders: "draft-8", legacyHeaders: false,
  handler: (req, res) => { res.status(429).json({ error: "RATE_LIMITED", message: "Zbyt wiele prób publikacji opinii. Spróbuj za chwilę.", requestId: req.requestId }); }
}), asyncHandler(async (req, res) => {
  const review = await createReview(req.auth!.accountId, req.auth!.role, String(req.params.bookingId), createReviewSchema.parse(req.body));
  res.status(201).json({ review });
}));

bookingRouter.post("/", asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  const booking = await createBooking(req.auth.accountId, req.auth.role, createBookingSchema.parse(req.body), bookingOperationKeySchema.parse(req.header("Idempotency-Key")));
  res.status(201).json({ booking });
}));

bookingRouter.post("/batch", asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  const { slots, ...shared } = createBookingsSchema.parse(req.body);
  const bookings = await createBookings(req.auth.accountId, req.auth.role, slots.map(slot => ({ ...shared, ...slot })), bookingOperationKeySchema.parse(req.header("Idempotency-Key")));
  res.status(201).json({ bookings, totalPriceCents: bookings.reduce((sum, booking) => sum + booking.priceCents, 0) });
}));

bookingRouter.get("/", asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  res.status(200).json(await listBookings(req.auth.accountId, req.auth.role, listBookingsSchema.parse(req.query)));
}));

bookingRouter.get("/operations/:key", asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  const key = bookingOperationKeySchema.unwrap().parse(req.params.key);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(await getBookingOperation(req.auth.accountId, req.auth.role, key));
}));

bookingRouter.get("/:bookingId", asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  const booking = await getBooking(req.auth.accountId, req.auth.role, String(req.params.bookingId));
  res.status(200).json({ booking });
}));

bookingRouter.patch("/:bookingId/status", asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  const input = updateBookingStatusSchema.parse(req.body);
  const booking = await updateBookingStatus(req.auth.accountId, req.auth.role, String(req.params.bookingId), input.status);
  res.status(200).json({ booking });
}));

export { bookingRouter };
