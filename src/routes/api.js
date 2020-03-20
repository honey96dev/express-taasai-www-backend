import express from "express";
import expressJwt from "express-jwt";
import {session} from "core/config";

import authRouter from "./api/auth";
import profileRouter from "./api/profile";
import coreRouter from "./api/core";
import driversRouter from "./api/drivers";
import mapRouter from "./api/map";
import commissionRouter from "./api/commission";

const router = express.Router();

router.use("/", expressJwt({secret: session.secret})
  .unless({
    path: [
      /\/auth\/*/,
    ]
  }));

router.use("/auth", authRouter);
router.use("/profile", profileRouter);
router.use("/core", coreRouter);
router.use("/drivers", driversRouter);
router.use("/map", mapRouter);
router.use("/commission", commissionRouter);
// router.use("/account", accountRouter);

export default router;
