import express, { Router } from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth.routes";
import alertsRoutes from "./routes/alerts.routes";
import auditLogsRoutes from "./routes/auditLogs.routes";
import authorizeRoutes from "./routes/authorize.routes";
import agentsRoutes from "./routes/agents.routes";
import policiesRoutes from "./routes/policies.routes";
import merchantsRoutes from "./routes/merchants.routes";
import transactionsRoutes from "./routes/transactions.routes";
import killSwitchRoutes from "./routes/killSwitch.routes";
import approvalsRoutes from "./routes/approvals.routes";
import analyticsRoutes from "./routes/analytics.routes";

const app = express();

app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
  });
});

const v1Router = Router();
v1Router.use("/auth", authRoutes);
v1Router.use("/alerts", alertsRoutes);
v1Router.use("/audit-logs", auditLogsRoutes);
v1Router.use("/agents", agentsRoutes);
v1Router.use("/policies", policiesRoutes);
v1Router.use("/merchants", merchantsRoutes);
v1Router.use("/transactions", transactionsRoutes);
v1Router.use("/kill-switch", killSwitchRoutes);
v1Router.use("/approvals", approvalsRoutes);
v1Router.use("/analytics", analyticsRoutes);
v1Router.use("/", authorizeRoutes);

app.use("/v1", v1Router);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`PolicyPay backend running on http://localhost:${env.PORT}`);
});

export default app;
