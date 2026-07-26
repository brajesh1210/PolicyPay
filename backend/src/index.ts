import express, { Router } from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth.routes";

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

app.use("/v1", v1Router);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`PolicyPay backend running on http://localhost:${env.PORT}`);
});

export default app;
