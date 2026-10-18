import { Router } from "express";

import { requireAuth } from "../middleware/require-auth";
import { createBooking, getBooking, listBookings, updateBookingStatus } from "../services/booking.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import { createBookingSchema, listBookingsSchema, updateBookingStatusSchema } from "../validation/booking.schemas";

const bookingRouter = Router();
bookingRouter.use(requireAuth);

bookingRouter.post("/", asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  const booking = await createBooking(req.auth.accountId, req.auth.role, createBookingSchema.parse(req.body));
  res.status(201).json({ booking });
}));

bookingRouter.get("/", asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  res.status(200).json(await listBookings(req.auth.accountId, req.auth.role, listBookingsSchema.parse(req.query)));
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
