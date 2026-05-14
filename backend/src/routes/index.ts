import { Router } from "express";

import { authRouter } from "./auth.routes";
import { petsRouter } from "./pets.routes";
import { userRouter } from "./user.routes";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/pets", petsRouter);
apiRouter.use("/users", userRouter);

export { apiRouter };
