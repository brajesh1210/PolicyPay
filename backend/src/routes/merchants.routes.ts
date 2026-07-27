import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { merchantsController } from "../controllers/merchants.controller";

const router = Router();

router.use(adminAuth);

router.get("/", (req, res, next) => merchantsController.list(req, res, next));
router.post("/", (req, res, next) => merchantsController.create(req, res, next));
router.patch("/:id/reputation", (req, res, next) => merchantsController.updateReputation(req, res, next));
router.delete("/:id", (req, res, next) => merchantsController.delete(req, res, next));

export default router;
