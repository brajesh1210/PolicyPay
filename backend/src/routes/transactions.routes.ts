import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { transactionsController } from "../controllers/transactions.controller";

const router = Router();

router.use(adminAuth);

router.get("/", (req, res, next) => transactionsController.list(req, res, next));
router.get("/:id", (req, res, next) => transactionsController.getById(req, res, next));

export default router;
