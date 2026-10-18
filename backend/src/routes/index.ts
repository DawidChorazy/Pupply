import { gamificationRouter } from "./gamification.routes";
import { documentRouter } from "./document.routes";
import { accountRouter, adminRouter } from "./account.routes";
import { petShareRouter, sharedPetRouter } from "./pet-share.routes";
import { Router } from "express";

import { authRouter } from "./auth.routes";
import { bookingRouter } from "./booking.routes";
import { clinicRouter } from "./clinic.routes";
import { notificationRouter } from "./notification.routes";
import { petsRouter } from "./pets.routes";
import { sitterRouter } from "./sitter.routes";
import { userRouter } from "./user.routes";
import { uploadRouter } from "./upload.routes";
import { locationRouter } from "./location.routes";

const apiRouter = Router();
apiRouter.use("/account", accountRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/gamification", gamificationRouter);
apiRouter.use("/locations", locationRouter);

apiRouter.use("/auth", authRouter);
apiRouter.use("/bookings", bookingRouter);
apiRouter.use("/clinics", clinicRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/pets/:petId/documents", documentRouter);
apiRouter.use("/pets/:petId/shares", petShareRouter);
apiRouter.use("/shared-pets", sharedPetRouter);
apiRouter.use("/pets", petsRouter);
apiRouter.use("/sitters", sitterRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/uploads", uploadRouter);

export { apiRouter };
