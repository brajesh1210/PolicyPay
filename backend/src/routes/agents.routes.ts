import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { agentsController } from "../controllers/agents.controller";

const router = Router();

router.use(adminAuth);

router.get("/", (req, res, next) => agentsController.list(req, res, next));
router.post("/", (req, res, next) => agentsController.create(req, res, next));
router.get("/:id", (req, res, next) => agentsController.getById(req, res, next));
router.put("/:id", (req, res, next) => agentsController.update(req, res, next));
router.patch("/:id", (req, res, next) => agentsController.update(req, res, next));
router.delete("/:id", (req, res, next) => agentsController.delete(req, res, next));

router.patch("/:id/kill-switch", (req, res, next) => agentsController.setKillSwitch(req, res, next));

router.post("/:id/api-keys", (req, res, next) => agentsController.createApiKey(req, res, next));
router.get("/:id/api-keys", (req, res, next) => agentsController.listApiKeys(req, res, next));
router.delete("/:id/api-keys/:keyId", (req, res, next) => agentsController.revokeApiKey(req, res, next));

export default router;
