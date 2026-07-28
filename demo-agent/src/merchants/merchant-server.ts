import express, { Express } from "express";
import { Server } from "http";

export interface MerchantConfig {
  port: number;
  domain: string;
  name: string;
  priceUsd: number;
}

/**
 * Creates a mock merchant server for PolicyPay demo.
 *
 * NOTE:
 * - HTTP 402 status code represents "Payment Required".
 * - These endpoint responses simulate pretend merchant shops used strictly for demonstration.
 */
export function createMerchantServer(config: MerchantConfig): Express {
  const app = express();
  app.use(express.json());

  // GET /paid-resource: Simulates payment wall by returning HTTP 402 Payment Required
  app.get("/paid-resource", (_req, res) => {
    res.status(402).json({
      error: "payment_required",
      merchant: {
        domain: config.domain,
        name: config.name,
      },
      amount_usd: config.priceUsd,
      currency: "USDC",
      resource: "/paid-resource",
      description: "Market data feed, 1 hour access",
    });
  });

  // POST /paid-resource/claim: Accepts x402 payment proof/settlement payload
  app.post("/paid-resource/claim", (req, res) => {
    const { signed_payload } = req.body || {};

    if (!signed_payload) {
      res.status(400).json({
        error: "missing_payment",
      });
      return;
    }

    res.status(200).json({
      ok: true,
      data: {
        symbol: "BTC/USD",
        price: 64230.55,
      },
      message: "Payment accepted, here is your data",
    });
  });

  return app;
}

/**
 * Helper to create and start a merchant server instance.
 */
export function start(config: MerchantConfig): Server {
  const app = createMerchantServer(config);
  return app.listen(config.port, () => {
    console.log(`merchant ${config.name} listening on ${config.port}`);
  });
}
