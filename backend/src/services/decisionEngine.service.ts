import { Policy } from "@prisma/client";
import { Decision, REASON_CODES } from "@policypay/contracts";

export interface DecisionResult {
  decision: Decision;
  primaryReasonCode: string;
}

export class DecisionEngineService {
  makeDecision(
    policyFailed: boolean,
    policyReasonCode: string | undefined,
    riskScore: number,
    policy: Policy
  ): DecisionResult {
    if (policyFailed) {
      return {
        decision: "DENY",
        primaryReasonCode: policyReasonCode || REASON_CODES.KILL_SWITCH_ACTIVE,
      };
    }

    if (riskScore >= policy.denyThresholdScore) {
      return {
        decision: "DENY",
        primaryReasonCode: REASON_CODES.RISK_THRESHOLD_DENY,
      };
    }

    if (riskScore >= policy.approvalThresholdScore) {
      return {
        decision: "REQUIRE_APPROVAL",
        primaryReasonCode: REASON_CODES.RISK_THRESHOLD_APPROVAL,
      };
    }

    return {
      decision: "ALLOW",
      primaryReasonCode: REASON_CODES.ALL_CHECKS_PASSED,
    };
  }
}

export const decisionEngineService = new DecisionEngineService();
