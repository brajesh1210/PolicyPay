import { Router } from "express";
import { apiKeyAuth } from "../middleware/apiKeyAuth";
import { authorizeController } from "../controllers/authorize.controller";

const router = Router();

router.post("/authorize-payment", apiKeyAuth, (req, res, next) =>
  authorizeController.authorizePayment(req, res, next)
);

export default router;
