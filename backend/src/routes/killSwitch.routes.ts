import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { killSwitchController } from "../controllers/killSwitch.controller";

const router = Router();

router.use(adminAuth);

router.get("/", (req, res, next) => killSwitchController.getStatus(req, res, next));
router.patch("/", (req, res, next) => killSwitchController.setStatus(req, res, next));

export default router;
