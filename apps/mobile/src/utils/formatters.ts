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
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
};

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

