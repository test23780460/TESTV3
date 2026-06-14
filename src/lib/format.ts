export const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function formatPrice(value: number) {
  return value >= 1000 ? money.format(value) : `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatPct(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function tone(value: number | string) {
  if (typeof value === "number") return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
  if (["Watch", "Bullish", "Positive", "Live", "Configured", "correct"].includes(value)) return "positive";
  if (["Avoid", "Bearish", "Negative", "Invalid key", "incorrect"].includes(value)) return "negative";
  if (["Wait", "Neutral", "Missing key", "Cached", "Delayed", "Market closed", "partial", "Unconfigured"].includes(value)) return "warning";
  return "";
}
