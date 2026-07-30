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
import simulationRoutes from "./routes/simulation.routes";

const app = express();

app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));
// CORS_ORIGIN is a comma-separated list, e.g.
//   http://localhost:3000,https://policypay.vercel.app
const allowedOrigins = (env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // server-to-server calls (curl, the demo agent) send no Origin
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // any Vercel preview deployment
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
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
v1Router.use("/simulate", simulationRoutes);
v1Router.use("/", authorizeRoutes);

app.use("/v1", v1Router);

app.use(errorHandler);

app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`PolicyPay backend running on http://localhost:${env.PORT}`);
});

export default app;
