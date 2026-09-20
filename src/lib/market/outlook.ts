import {
  INDICATOR_BY_ID,
  smaArr,
  emaArr,
  rmaArr,
  trueRange,
  closes,
  type PlotSpec,
} from "./indicators";
import type { Bar, Quote } from "./types";

export type Bias = "strong-bullish" | "bullish" | "neutral" | "bearish" | "strong-bearish";

export type Outlook = {
  bias: Bias;
  score: number;
  conviction: number;
  convictionReasons: string[];
  headline: string;
  summary: string;
  bullets: string[];
  plays: string[];
  levels: { label: string; value: number }[];
  snapshot: { label: string; value: string; tone: "up" | "down" | "neutral" }[];
};

function last(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i];
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

function slope(arr: (number | null)[], n = 5): number {
  const vals: number[] = [];
  for (let i = arr.length - 1; i >= 0 && vals.length < n; i--) {
    if (arr[i] != null) vals.push(arr[i]!);
  }
  if (vals.length < 2) return 0;
  return vals[0]! - vals[vals.length - 1]!;
}

function fmt(n: number, d = 2): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
}

export function buildOutlook(bars: Bar[], quote: Quote): Outlook {
  if (bars.length < 30) {
    return {
      bias: "neutral",
      score: 0,
      conviction: 0.2,
      convictionReasons: [
        "Fewer than 30 bars — trend and momentum scores are unreliable.",
        "Switch to 1D or 1W for a structural read before trusting conviction.",
      ],
      headline: "Not enough history for a full read",
      summary: `${quote.shortName || quote.symbol} needs more bars before trend, momentum and volatility can be scored with confidence.`,
      bullets: ["Load a longer timeframe (1D or 1W) for a structural view."],
      plays: ["Wait for more history before sizing a short-term trade."],
      levels: [],
      snapshot: [],
    };
  }

  const c = closes(bars);
  const price = quote.price || c[c.length - 1]!;
  const sma20 = smaArr(c, 20);
  const sma50 = smaArr(c, Math.min(50, bars.length - 1));
  const sma200 = smaArr(c, Math.min(200, bars.length - 1));
  const ema21 = emaArr(c, 21);
  const s20 = last(sma20);
  const s50 = last(sma50);
  const s200 = last(sma200);
  const e21 = last(ema21);

  const rsiPlots = INDICATOR_BY_ID.rsi!.compute(bars, { length: 14 }, "#4db6a8");
  const macdPlots = INDICATOR_BY_ID.macd!.compute(bars, { fast: 12, slow: 26, signal: 9 }, "#4db6a8");
  const adxPlots = INDICATOR_BY_ID.adx!.compute(bars, { length: 14 }, "#4db6a8");
  const atrPlots = INDICATOR_BY_ID.atr!.compute(bars, { length: 14 }, "#4db6a8");
  const stochPlots = INDICATOR_BY_ID.stoch!.compute(bars, { k: 14, d: 3, smooth: 3 }, "#4db6a8");

  const rsi = lastVal(rsiPlots[0]);
  const macd = lastVal(macdPlots.find((p) => p.key === "macd"));
  const macdHist = lastVal(macdPlots.find((p) => p.key === "hist"));
  const adx = lastVal(adxPlots.find((p) => p.key === "adx"));
  const atr = lastVal(atrPlots[0]);
  const stochK = lastVal(stochPlots.find((p) => p.key === "k"));

  let score = 0;
  const bullets: string[] = [];

  if (s20 != null) {
    if (price > s20) {
      score += 1;
      bullets.push(`Price holds above the 20-period average (${fmt(s20)}).`);
    } else {
      score -= 1;
      bullets.push(`Price trades below the 20-period average (${fmt(s20)}).`);
    }
  }
  if (s50 != null) {
    if (price > s50) score += 1;
    else score -= 1;
  }
  if (s20 != null && s50 != null) {
    if (s20 > s50) {
      score += 0.8;
      bullets.push("Short average is above the 50-period average — short-term trend is up.");
    } else {
      score -= 0.8;
      bullets.push("Short average is below the 50-period average — short-term trend is down.");
    }
  }
  if (s200 != null) {
    if (price > s200) {
      score += 1.2;
      bullets.push(`Above the 200-period average (${fmt(s200)}) — longer-term structure is constructive.`);
    } else {
      score -= 1.2;
      bullets.push(`Below the 200-period average (${fmt(s200)}) — longer-term structure is heavy.`);
    }
  }

  if (rsi != null) {
    if (rsi >= 70) {
      score -= 0.4;
      bullets.push(`RSI at ${fmt(rsi, 1)} is stretched on the upside — pullback risk is elevated.`);
    } else if (rsi <= 30) {
      score += 0.4;
      bullets.push(`RSI at ${fmt(rsi, 1)} is oversold — bounce conditions are in place.`);
    } else if (rsi >= 55) {
      score += 0.5;
      bullets.push(`RSI at ${fmt(rsi, 1)} shows constructive momentum without being extreme.`);
    } else if (rsi <= 45) {
      score -= 0.5;
      bullets.push(`RSI at ${fmt(rsi, 1)} shows fading momentum.`);
    } else {
      bullets.push(`RSI at ${fmt(rsi, 1)} is balanced.`);
    }
  }

  if (macdHist != null) {
    if (macdHist > 0) {
      score += 0.7;
      bullets.push("MACD histogram is positive — upside momentum is in control.");
    } else {
      score -= 0.7;
      bullets.push("MACD histogram is negative — downside momentum is in control.");
    }
  }

  if (adx != null) {
    if (adx >= 25) bullets.push(`ADX at ${fmt(adx, 1)} confirms a real trend (not a range).`);
    else bullets.push(`ADX at ${fmt(adx, 1)} is muted — expect two-way, range-like trade.`);
  }

  const volSma = smaArr(
    bars.map((b) => b.volume),
    20,
  );
  const lastVol = bars[bars.length - 1]!.volume;
  const avgVol = last(volSma);
  if (avgVol && lastVol > avgVol * 1.4) {
    bullets.push("Latest volume is well above its 20-period average — the move is being participated in.");
    score += score >= 0 ? 0.3 : -0.3;
  }

  const prev = bars[bars.length - 2]!;
  const pp = (prev.high + prev.low + prev.close) / 3;
  const r1 = 2 * pp - prev.low;
  const s1 = 2 * pp - prev.high;
  const swingHigh = Math.max(...bars.slice(-20).map((b) => b.high));
  const swingLow = Math.min(...bars.slice(-20).map((b) => b.low));

  const atrPct = atr && price ? (atr / price) * 100 : null;
  if (atrPct != null) {
    bullets.push(
      `ATR is ${fmt(atrPct, 2)}% of price — ${atrPct > 3 ? "volatility is elevated" : atrPct < 1 ? "volatility is compressed" : "volatility is typical"}.`,
    );
  }

  const maxAbs = 6;
  const clamped = Math.max(-maxAbs, Math.min(maxAbs, score));
  const norm = clamped / maxAbs;
  const bias: Bias =
    norm > 0.55
      ? "strong-bullish"
      : norm > 0.18
        ? "bullish"
        : norm < -0.55
          ? "strong-bearish"
          : norm < -0.18
            ? "bearish"
            : "neutral";

  const labels: Record<Bias, string> = {
    "strong-bullish": "Strong bullish",
    bullish: "Bullish",
    neutral: "Neutral",
    bearish: "Bearish",
    "strong-bearish": "Strong bearish",
  };

  const name = quote.shortName || quote.symbol;
  const chg = quote.changePercent;
  const headline = `${labels[bias]} · ${name}`;
  const summary = `${name} (${quote.symbol}) last ${fmt(price)} (${chg >= 0 ? "+" : ""}${fmt(chg, 2)}%). Trend, momentum and volume score ${fmt(norm * 100, 0)} on a −100 to +100 scale. Nearby pivot support is ${fmt(s1)}; resistance is ${fmt(r1)}.`;

  const snapshot: Outlook["snapshot"] = [
    {
      label: "Bias",
      value: labels[bias],
      tone: norm > 0.18 ? "up" : norm < -0.18 ? "down" : "neutral",
    },
    {
      label: "RSI 14",
      value: rsi == null ? "—" : fmt(rsi, 1),
      tone: rsi != null && rsi >= 55 ? "up" : rsi != null && rsi <= 45 ? "down" : "neutral",
    },
    {
      label: "MACD",
      value: macd == null ? "—" : fmt(macd, 4),
      tone: macdHist != null && macdHist >= 0 ? "up" : "down",
    },
    {
      label: "ADX",
      value: adx == null ? "—" : fmt(adx, 1),
      tone: adx != null && adx >= 25 ? "up" : "neutral",
    },
    {
      label: "Stoch %K",
      value: stochK == null ? "—" : fmt(stochK, 1),
      tone: stochK != null && stochK >= 80 ? "down" : stochK != null && stochK <= 20 ? "up" : "neutral",
    },
    {
      label: "vs SMA20",
      value: s20 == null ? "—" : `${price >= s20 ? "+" : ""}${fmt(((price - s20) / s20) * 100, 2)}%`,
      tone: s20 != null && price >= s20 ? "up" : "down",
    },
  ];

  if (e21 != null) {
    snapshot.push({
      label: "EMA 21",
      value: fmt(e21),
      tone: price >= e21 ? "up" : "down",
    });
  }

  const sma20Slope = slope(sma20, 6);
  if (Math.abs(sma20Slope) > 0) {
    bullets.push(
      sma20Slope > 0
        ? "The 20-period average is rising — dips are more likely to be bought."
        : "The 20-period average is rolling over — rallies are more likely to be sold.",
    );
  }

  const conviction = Math.min(
    1,
    0.35 + Math.abs(norm) * 0.65 + (adx != null && adx > 25 ? 0.1 : 0),
  );
  const convictionReasons: string[] = [];
  const confPct = Math.round(conviction * 100);
  convictionReasons.push(
    `Score ${fmt(norm * 100, 0)}/100 on trend+momentum+volume drives ${confPct}% conviction.`,
  );
  if (adx != null) {
    convictionReasons.push(
      adx >= 25
        ? `ADX ${fmt(adx, 1)} ≥ 25: trend is established, so the bias is more reliable.`
        : `ADX ${fmt(adx, 1)} < 25: no strong trend — conviction is capped (range risk).`,
    );
  }
  if (rsi != null) {
    convictionReasons.push(
      rsi >= 70
        ? `RSI ${fmt(rsi, 1)} is overbought — high conviction can still mean mean-reversion risk.`
        : rsi <= 30
          ? `RSI ${fmt(rsi, 1)} is oversold — rebound setups raise confidence in a bounce bias.`
          : `RSI ${fmt(rsi, 1)} is mid-range — momentum is informative but not extreme.`,
    );
  }
  if (macdHist != null) {
    convictionReasons.push(
      macdHist > 0
        ? "MACD histogram positive: momentum agrees with a constructive bias."
        : "MACD histogram negative: momentum agrees with a defensive bias.",
    );
  }
  if (avgVol && lastVol > avgVol * 1.4) {
    convictionReasons.push("Volume spike vs 20-period average confirms participation in the move.");
  } else if (avgVol) {
    convictionReasons.push("Volume is near average — signal quality is ordinary, not amplified.");
  }
  if (Math.abs(norm) < 0.18) {
    convictionReasons.push("Mixed indicators keep bias neutral; treat levels, not direction, as primary.");
  }

  const plays: string[] = [];
  const stopPad = atr != null ? atr * 0.8 : price * 0.012;
  if (bias === "strong-bullish" || bias === "bullish") {
    plays.push(
      `Long bias: buy dips toward ${fmt(s1)} (S1); invalidation under ${fmt(s1 - stopPad)}. First target ${fmt(r1)} (R1), stretch ${fmt(swingHigh)}.`,
    );
    if (rsi != null && rsi >= 70) {
      plays.push(
        `RSI stretched (${fmt(rsi, 1)}): prefer waiting for a pullback to EMA21 (${e21 != null ? fmt(e21) : "n/a"}) instead of chasing.`,
      );
    } else if (s20 != null && price > s20) {
      plays.push(
        `Momentum long: hold while price stays above SMA20 (${fmt(s20)}); trail a stop under the rising average.`,
      );
    }
  } else if (bias === "strong-bearish" || bias === "bearish") {
    plays.push(
      `Short bias: sell rips toward ${fmt(r1)} (R1); invalidation above ${fmt(r1 + stopPad)}. First target ${fmt(s1)} (S1), stretch ${fmt(swingLow)}.`,
    );
    if (rsi != null && rsi <= 30) {
      plays.push(
        `RSI washed out (${fmt(rsi, 1)}): avoid aggressive shorts; look for a bounce into resistance to re-short.`,
      );
    } else if (s20 != null && price < s20) {
      plays.push(
        `Momentum short: pressure remains while under SMA20 (${fmt(s20)}); cover on reclaim of the average.`,
      );
    }
  } else {
    plays.push(
      `Range play: fade extremes between S1 ${fmt(s1)} and R1 ${fmt(r1)}; stand aside if price closes outside with rising volume.`,
    );
    plays.push(
      `Breakout watch: a daily close above ${fmt(swingHigh)} or below ${fmt(swingLow)} opens a short-term directional leg.`,
    );
  }
  if (atr != null) {
    plays.push(
      `Size with ATR ${fmt(atr)} (~${fmt((atr / price) * 100, 2)}% of price); keep risk per idea tight on short-term trades.`,
    );
  }

  return {
    bias,
    score: norm,
    conviction,
    convictionReasons: convictionReasons.slice(0, 5),
    headline,
    summary,
    bullets: bullets.slice(0, 7),
    plays: plays.slice(0, 4),
    levels: [
      { label: "Swing high", value: swingHigh },
      { label: "R1", value: r1 },
      { label: "Pivot", value: pp },
      { label: "S1", value: s1 },
      { label: "Swing low", value: swingLow },
    ],
    snapshot,
  };
}

function lastVal(plot: PlotSpec | undefined): number | null {
  if (!plot || !plot.data.length) return null;
  return plot.data[plot.data.length - 1]!.value;
}
