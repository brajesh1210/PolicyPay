import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { approvalsController } from "../controllers/approvals.controller";

const router = Router();

router.use(adminAuth);

router.get("/", (req, res, next) => approvalsController.list(req, res, next));
router.post("/:id/approve", (req, res, next) => approvalsController.approve(req, res, next));
router.post("/:id/reject", (req, res, next) => approvalsController.reject(req, res, next));

export default router;
