import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { auditLogsController } from "../controllers/auditLogs.controller";

const router = Router();

router.use(adminAuth);

router.get("/", (req, res, next) => auditLogsController.list(req, res, next));

export default router;
