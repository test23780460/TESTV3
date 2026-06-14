import type { Asset, Prediction } from "../types";

export function signalScore(asset: Asset) {
  const trend = asset.momentum * 0.24 + asset.technical * 0.28 + asset.sentiment * 0.14;
  const quality = asset.dataQuality * 0.18 + asset.liquidity * 0.08;
  const penalty = asset.risk * 0.12;
  return Math.max(0, Math.min(100, Math.round(trend + quality - penalty)));
}

export function buildPrediction(asset: Asset, horizonDays: 7 | 14 | 30 = 14): Prediction {
  const score = signalScore(asset);
  const range = asset.price * (asset.volatility / 100) * Math.sqrt(horizonDays / 252);
  const direction = score >= 65 ? "Bullish" : score <= 40 ? "Bearish" : "Neutral";
  const drift = direction === "Bullish" ? range * 0.35 : direction === "Bearish" ? -range * 0.35 : 0;
  return {
    symbol: asset.symbol,
    horizonDays,
    direction,
    confidence: Math.min(asset.confidence, asset.dataQuality + 35),
    startingPrice: asset.price,
    predictedLow: Number((asset.price + drift - range).toFixed(2)),
    predictedHigh: Number((asset.price + drift + range).toFixed(2)),
    predictedPrice: Number((asset.price + drift).toFixed(2)),
    signalScore: score,
    explanation: `${asset.symbol} is ${direction.toLowerCase()} because momentum, technical score, sentiment, risk, liquidity, and data quality produce a ${score}/100 signal score. This is educational research only, not financial advice.`,
    status: "active",
    modelVersion: "rules-v1",
    generatedAt: new Date().toISOString()
  };
}

export function evaluatePrediction(prediction: Prediction, actualPrice: number) {
  const withinRange = actualPrice >= prediction.predictedLow && actualPrice <= prediction.predictedHigh;
  const movement = actualPrice - prediction.startingPrice;
  const directionCorrect =
    prediction.direction === "Neutral" ? Math.abs(movement / prediction.startingPrice) < 0.02 :
    prediction.direction === "Bullish" ? movement >= 0 : movement <= 0;
  if (withinRange && directionCorrect) return "correct";
  if (withinRange || directionCorrect) return "partial";
  return "incorrect";
}
