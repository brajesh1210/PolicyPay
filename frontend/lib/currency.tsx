"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * The backend always stores and returns amounts in USD.
 * This is a display-layer conversion only — nothing is sent to the API in INR.
 */
export const USD_TO_INR = 95.65;

export type Currency = "USD" | "INR";

const STORAGE_KEY = "policypay.currency";

type Ctx = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  /** Formats a USD amount in whichever currency is currently selected. */
  money: (usd: number | null | undefined) => string;
  /** Always formats in USD, whatever the setting — for places that must stay canonical. */
  moneyUsd: (usd: number | null | undefined) => string;
  rate: number;
};

const CurrencyContext = createContext<Ctx | null>(null);

function fmtUSD(usd: number): string {
  return "$" + usd.toFixed(2);
}

function fmtINR(usd: number): string {
  const inr = usd * USD_TO_INR;
  // Indian grouping: 1,23,456.78
  return (
    "₹" +
    inr.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("USD");

  // Read the saved preference after mount so server and client markup match.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "INR" || saved === "USD") setCurrencyState(saved);
    } catch {
      /* localStorage can be blocked — fall back to USD */
    }
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    try {
      window.localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* ignore */
    }
  }, []);

  const money = useCallback(
    (usd: number | null | undefined) => {
      const v = typeof usd === "number" && isFinite(usd) ? usd : 0;
      return currency === "INR" ? fmtINR(v) : fmtUSD(v);
    },
    [currency]
  );

  const moneyUsd = useCallback((usd: number | null | undefined) => {
    const v = typeof usd === "number" && isFinite(usd) ? usd : 0;
    return fmtUSD(v);
  }, []);

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, money, moneyUsd, rate: USD_TO_INR }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

/** Falls back to plain USD formatting if the provider is missing. */
export function useCurrency(): Ctx {
  const ctx = useContext(CurrencyContext);
  if (ctx) return ctx;
  return {
    currency: "USD",
    setCurrency: () => {},
    money: (usd) => fmtUSD(typeof usd === "number" && isFinite(usd) ? usd : 0),
    moneyUsd: (usd) => fmtUSD(typeof usd === "number" && isFinite(usd) ? usd : 0),
    rate: USD_TO_INR,
  };
}

/** Shorthand for the common case. */
export function useMoney() {
  return useCurrency().money;
}
