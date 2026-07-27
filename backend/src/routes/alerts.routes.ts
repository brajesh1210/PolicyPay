import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { alertsController } from "../controllers/alerts.controller";

const router = Router();

router.use(adminAuth);

router.get("/", (req, res, next) => alertsController.list(req, res, next));
router.patch("/:id/read", (req, res, next) => alertsController.markRead(req, res, next));
router.patch("/:id/dismiss", (req, res, next) => alertsController.dismiss(req, res, next));

export default router;
