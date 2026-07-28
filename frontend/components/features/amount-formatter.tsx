import React from "react";

interface AmountFormatterProps {
  amount: number;
  currency?: string;
}

export function AmountFormatter({ amount, currency = "USD" }: AmountFormatterProps) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount || 0);

  return <span className="font-mono font-medium">{formatted}</span>;
}