import type {
  BloodGroup,
  DailyUse,
  Forecast,
  ForecastDay,
  Shock,
} from "./types";

function getUTCDOW(isoDate: string): number {
  return new Date(isoDate + "T00:00:00Z").getUTCDay();
}

function addDaysToISO(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function computeForecast(
  history: DailyUse[],
  siteId: string,
  group: BloodGroup,
  today: string,
  shocks: Shock[] = []
): Forecast {
  // Filter and sort historical daily use by date ascending
  const series = history
    .filter((h) => h.siteId === siteId && h.group === group)
    .sort((a, b) => a.date.localeCompare(b.date));

  // If insufficient history, return safe fallback
  if (series.length < 28) {
    const daily: ForecastDay[] = [];
    for (let d = 0; d < 14; d++) {
      daily.push({ day: d, mean: 1, p90: 2 });
    }
    return { siteId, group, daily, wape: 0 };
  }

  // 1. DOW index: mean per weekday / overall mean (clamped 0.5 - 1.8)
  const dowSums = new Array<number>(7).fill(0);
  const dowCounts = new Array<number>(7).fill(0);
  let totalUnits = 0;

  for (const item of series) {
    const dow = getUTCDOW(item.date);
    dowSums[dow] += item.units;
    dowCounts[dow] += 1;
    totalUnits += item.units;
  }

  const overallMean = totalUnits / Math.max(1, series.length);
  const dowIndex = new Array<number>(7).fill(1.0);

  if (overallMean > 1e-4) {
    for (let i = 0; i < 7; i++) {
      const meanDow = dowCounts[i] > 0 ? dowSums[i] / dowCounts[i] : overallMean;
      dowIndex[i] = clamp(meanDow / overallMean, 0.5, 1.8);
    }
  }

  // Helper to deseasonalise a series
  const deseasonalised = series.map((item) => {
    const dow = getUTCDOW(item.date);
    const idx = dowIndex[dow] || 1.0;
    return item.units / Math.max(1e-4, idx);
  });

  // 2. Backtest to estimate residual sigma and WAPE
  // Train on days 0 to N-15, test on last 14 days (N-14 to N-1)
  const N = series.length;
  const trainLen = Math.max(28, N - 14);
  const testLen = N - trainLen;

  let testActualSum = 0;
  let testAbsErrSum = 0;
  const residuals: number[] = [];

  if (testLen > 0) {
    // Fit level on the 14 days prior to trainLen
    const btLookback = Math.min(14, trainLen);
    let btWWeightSum = 0;
    let btWUnitsSum = 0;
    for (let k = 1; k <= btLookback; k++) {
      const idx = trainLen - btLookback + (k - 1);
      btWWeightSum += k;
      btWUnitsSum += k * deseasonalised[idx];
    }
    const btLevel = btWWeightSum > 0 ? btWUnitsSum / btWWeightSum : overallMean;

    for (let k = 0; k < testLen; k++) {
      const actualItem = series[trainLen + k];
      const dow = getUTCDOW(actualItem.date);
      const pred = Math.max(0, btLevel * dowIndex[dow]);
      const err = actualItem.units - pred;
      residuals.push(err);
      testActualSum += actualItem.units;
      testAbsErrSum += Math.abs(err);
    }
  }

  const wape =
    testActualSum > 0 ? testAbsErrSum / testActualSum : (testAbsErrSum > 0 ? 1 : 0);

  // Residual standard deviation
  let sigma = 0.5;
  if (residuals.length > 0) {
    const rMean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
    const variance =
      residuals.reduce((acc, r) => acc + Math.pow(r - rMean, 2), 0) /
      residuals.length;
    sigma = Math.sqrt(variance);
  }
  // Ensure minimum realistic uncertainty based on overall volume
  sigma = Math.max(0.4, Math.max(sigma, Math.sqrt(Math.max(0.2, overallMean * 0.3))));

  // 3. Level: linearly weighted average of last 14 deseasonalised days
  const last14Count = Math.min(14, N);
  let wSum = 0;
  let weightedUnits = 0;
  for (let k = 1; k <= last14Count; k++) {
    const idx = N - last14Count + (k - 1);
    wSum += k;
    weightedUnits += k * deseasonalised[idx];
  }
  const level = wSum > 0 ? weightedUnits / wSum : overallMean;

  // 4. Trend: slope of the last 28 days, damped (x0.9^d) and clamped to ±10% level per week
  const trendWindow = Math.min(28, N);
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let x = 0; x < trendWindow; x++) {
    const y = deseasonalised[N - trendWindow + x];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const meanX = sumX / trendWindow;
  const meanY = sumY / trendWindow;
  const denom = sumXX - trendWindow * meanX * meanX;
  let rawSlope = denom !== 0 ? (sumXY - trendWindow * meanX * meanY) / denom : 0;

  // Clamp slope to ±10% of level per week (i.e. ± (0.10 * level) / 7 per day)
  const maxSlopeDaily = (0.1 * Math.max(1, level)) / 7;
  const slope = clamp(rawSlope, -maxSlopeDaily, maxSlopeDaily);

  // 5. Generate 14-day forward forecast (days 0..13)
  const daily: ForecastDay[] = [];
  for (let d = 0; d < 14; d++) {
    const dateStr = addDaysToISO(today, d);
    const dow = getUTCDOW(dateStr);
    const dampedTrend = slope * d * Math.pow(0.9, d);
    const baseDemand = Math.max(0, (level + dampedTrend) * dowIndex[dow]);

    // Check shocks
    let shockMultiplier = 1.0;
    for (const s of shocks) {
      if (
        s.siteId === siteId &&
        s.groups.includes(group) &&
        d >= s.fromDay &&
        d <= s.toDay
      ) {
        shockMultiplier *= s.multiplier;
      }
    }

    const mean = Math.max(0.1, baseDemand * shockMultiplier);
    const p90 = Math.max(mean, mean + 1.28 * sigma * Math.sqrt(shockMultiplier));

    daily.push({
      day: d,
      mean: Math.round(mean * 10) / 10,
      p90: Math.round(p90 * 10) / 10,
    });
  }

  return {
    siteId,
    group,
    daily,
    wape: Math.round(wape * 1000) / 1000,
  };
}
