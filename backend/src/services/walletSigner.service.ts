import crypto from "crypto";
import { env } from "../config/env";

export interface X402SignResult {
  signed_payload: string;
  network: string;
}

// Mock wallet signer for the PolicyPay demo
export class WalletSignerService {
  signX402(): X402SignResult {
    const randomHex = crypto.randomBytes(16).toString("hex"); // 32 hex chars
    return {
      signed_payload: `0xMOCK_${randomHex}`,
      network: env.X402_NETWORK,
    };
  }
}

export const walletSignerService = new WalletSignerService();
