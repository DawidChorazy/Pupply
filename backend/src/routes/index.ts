import { Router } from "express";

import { authRouter } from "./auth.routes";
import { bookingRouter } from "./booking.routes";
import { clinicRouter } from "./clinic.routes";
import { notificationRouter } from "./notification.routes";
import { petsRouter } from "./pets.routes";
import { sitterRouter } from "./sitter.routes";
import { userRouter } from "./user.routes";
import { uploadRouter } from "./upload.routes";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/bookings", bookingRouter);
apiRouter.use("/clinics", clinicRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/pets", petsRouter);
apiRouter.use("/sitters", sitterRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/uploads", uploadRouter);

export { apiRouter };
