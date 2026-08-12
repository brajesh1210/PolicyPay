import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { policiesController } from "../controllers/policies.controller";

const router = Router();

router.use(adminAuth);

router.get("/", (req, res, next) => policiesController.list(req, res, next));
router.get("/templates", (req, res, next) => policiesController.getTemplates(req, res, next));
router.post("/", (req, res, next) => policiesController.createCustom(req, res, next));
router.post("/from-template", (req, res, next) => policiesController.createFromTemplate(req, res, next));

router.get("/:id", (req, res, next) => policiesController.getById(req, res, next));
router.put("/:id", (req, res, next) => policiesController.update(req, res, next));
router.patch("/:id", (req, res, next) => policiesController.update(req, res, next));
router.patch("/:id/toggle", (req, res, next) => policiesController.toggle(req, res, next));
router.delete("/:id", (req, res, next) => policiesController.delete(req, res, next));

export default router;
