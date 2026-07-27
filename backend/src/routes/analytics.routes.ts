import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { analyticsController } from "../controllers/analytics.controller";

const router = Router();

router.use(adminAuth);

router.get("/overview", (req, res, next) => analyticsController.getOverview(req, res, next));
router.get("/spending-trends", (req, res, next) => analyticsController.getSpendingTrends(req, res, next));
router.get("/status-distribution", (req, res, next) => analyticsController.getStatusDistribution(req, res, next));
router.get("/recent-transactions", (req, res, next) => analyticsController.getRecentTransactions(req, res, next));

export default router;
