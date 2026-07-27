import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { simulationController } from "../controllers/simulation.controller";

const router = Router();

router.use(adminAuth);

router.post("/", (req, res, next) => simulationController.simulate(req, res, next));
router.post("/replay", (req, res, next) => simulationController.replay(req, res, next));

export default router;
