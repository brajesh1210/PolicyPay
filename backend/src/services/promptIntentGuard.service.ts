export const INJECTION_PHRASES = [
  "ignore previous instructions",
  "ignore all previous",
  "disregard previous",
  "send all funds",
  "transfer all funds",
  "drain the wallet",
  "empty the wallet",
  "override policy",
  "bypass policy",
  "you are now",
  "new instructions:",
] as const;

export interface CheckResult {
  flagged: boolean;
  matched: string | null;
}

export class PromptIntentGuardService {
  check(purpose?: string): CheckResult {
    if (!purpose) {
      return { flagged: false, matched: null };
    }

    const lower = purpose.toLowerCase();
    for (const phrase of INJECTION_PHRASES) {
      if (lower.includes(phrase)) {
        return { flagged: true, matched: phrase };
      }
    }

    return { flagged: false, matched: null };
  }
}

export const promptIntentGuardService = new PromptIntentGuardService();
