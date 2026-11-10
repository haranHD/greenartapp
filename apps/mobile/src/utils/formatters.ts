// Greenart Domain Utilities, Conversions & Formatting Helpers

export interface LandUsageOption {
  id: number;
  label: string;
}

export const LAND_USAGES: LandUsageOption[] = [
  { id: 1, label: 'Residential' },
  { id: 2, label: 'Commercial' },
  { id: 3, label: 'Agricultural' },
  { id: 5, label: 'Industrial' },
  { id: 6, label: 'Mixed-Use' },
];

/**
 * Formats numeric Indian currency rates into readable Lakhs (e.g. ₹14.50 L) or standard currency.
 */
export const formatLakhs = (val?: number): string => {
  if (val === undefined || val === null || isNaN(val)) return '—';
  if (val >= 100000) {
    const lakhs = val / 100000;
    return `₹${lakhs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
  }
  if (val > 0 && val < 1000) {
    // Value is already in Lakhs (e.g. 10.92)
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
  }
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
};

export interface MarketRateBuffer {
  rawRate: number;
  lowerRate: number;
  upperRate: number;
  approximateRate: number;
  midpointRate: number;
  unit: string;
  isLakhs: boolean;
  lowerFormatted: string;
  upperFormatted: string;
  approximateFormatted: string;
  rangeFormatted: string;
  displayEstimatedRange: string;
  displayApproximateRate: string;
}

/**
 * Automatically wraps a specific land rate into a realistic market buffer (e.g., quarters like .00, .25, .50, .75)
 * and provides a clean approximate anchor rate.
 *
 * Example:
 * Input: 10.92 L / Cent
 * Output:
 *   - Estimated Range: ₹10.75 L – ₹11.00 L / Cent
 *   - Approximate Market Rate: ₹10.90 L / Cent
 */
export function calculateMarketRateBuffer(
  val?: number,
  unit: string = 'Cent',
  customStep?: number
): MarketRateBuffer {
  if (val === undefined || val === null || isNaN(val) || val <= 0) {
    return {
      rawRate: 0,
      lowerRate: 0,
      upperRate: 0,
      approximateRate: 0,
      midpointRate: 0,
      unit,
      isLakhs: true,
      lowerFormatted: '—',
      upperFormatted: '—',
      approximateFormatted: '—',
      rangeFormatted: '—',
      displayEstimatedRange: `Estimated Range: — / ${unit}`,
      displayApproximateRate: `Approximate Market Rate: — / ${unit}`,
    };
  }

  const isPerSqFt = unit.toLowerCase().includes('sq');
  const isLakhUnit = !isPerSqFt;

  let lowerRate = 0;
  let upperRate = 0;
  let approximateRate = 0;
  let midpointRate = 0;
  let lowerFormatted = '';
  let upperFormatted = '';
  let approximateFormatted = '';

  if (isLakhUnit) {
    // If val is raw Rupees (>= 1,000), convert to Lakhs. Otherwise val is already in Lakhs.
    const lakhs = val >= 1000 ? val / 100000 : val;
    const step = customStep ?? 0.25;

    let lowerLakhs = Math.floor(lakhs / step) * step;
    let upperLakhs = Math.ceil(lakhs / step) * step;

    if (lowerLakhs === upperLakhs) {
      lowerLakhs = Math.max(0, lakhs - step);
      upperLakhs = lakhs + step;
    }

    // Clean approximate rate rounded to nearest 0.05 clean decimal (e.g. 10.90L, 10.95L)
    const approxLakhs = Math.round(lakhs / 0.05) * 0.05;
    const midLakhs = (lowerLakhs + upperLakhs) / 2;

    lowerRate = Math.round(lowerLakhs * 100) / 100;
    upperRate = Math.round(upperLakhs * 100) / 100;
    approximateRate = Math.round(approxLakhs * 100) / 100;
    midpointRate = Math.round(midLakhs * 1000) / 1000;

    lowerFormatted = `₹${lowerRate.toFixed(2)} L`;
    upperFormatted = `₹${upperRate.toFixed(2)} L`;
    approximateFormatted = `₹${approximateRate.toFixed(2)} L`;
  } else {
    // Per Sq.Ft rates in Rupees
    const step = customStep ?? (val >= 5000 ? 100 : 50);
    let lower = Math.floor(val / step) * step;
    let upper = Math.ceil(val / step) * step;

    if (lower === upper) {
      lower = Math.max(0, val - step);
      upper = val + step;
    }

    const approx = Math.round(val / (step / 2)) * (step / 2);
    const mid = (lower + upper) / 2;

    lowerRate = lower;
    upperRate = upper;
    approximateRate = approx;
    midpointRate = mid;

    lowerFormatted = `₹${Math.round(lowerRate).toLocaleString('en-IN')}`;
    upperFormatted = `₹${Math.round(upperRate).toLocaleString('en-IN')}`;
    approximateFormatted = `₹${Math.round(approximateRate).toLocaleString('en-IN')}`;
  }

  const rangeFormatted = `${lowerFormatted} – ${upperFormatted}`;
  const displayEstimatedRange = `Estimated Range: ${rangeFormatted} / ${unit}`;
  const displayApproximateRate = `Approximate Market Rate: ${approximateFormatted} / ${unit}`;

  return {
    rawRate: val,
    lowerRate,
    upperRate,
    approximateRate,
    midpointRate,
    unit,
    isLakhs: isLakhUnit,
    lowerFormatted,
    upperFormatted,
    approximateFormatted,
    rangeFormatted,
    displayEstimatedRange,
    displayApproximateRate,
  };
}

/**
 * Calculates geodesic distance in meters between two lat/lng coordinates (Haversine formula).
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

