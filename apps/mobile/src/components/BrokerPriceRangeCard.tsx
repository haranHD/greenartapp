import { AppText as Text } from './AppText';
import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { MarketPriceRange, LiveMarketCompsDto, mobileApi } from '../services/api';
import { formatLakhs } from '../utils/formatters';

export function cleanAddress(str?: string | null): string {
  if (!str) return '';
  const parts = str.split(',').map(p => p.trim()).filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (/^\d{6}$/.test(part) || lower === 'india' || lower === 'selected pin location' || lower === 'taluk' || lower === 'sublocality') continue;
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(part);
    }
  }
  return unique.join(', ');
}

export function BrokerPriceRangeCard({ latitude, longitude, landUsage, roadAccess, displayUnit, area, areaUnit, liveMarketComps }: {
  latitude: number; longitude: number; landUsage: number; roadAccess: string; displayUnit: 'Cent' | 'SqFt'; area?: number; areaUnit?: string;
  liveMarketComps?: LiveMarketCompsDto | null;
}) {
  const [range, setRange] = useState<MarketPriceRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (liveMarketComps && liveMarketComps.minPricePerCentLakhs > 0) {
      setLoading(false);
      setError(false);
      return;
    }
    const controller = new AbortController(); let current = true;
    setRange(null); setLoading(true); setError(false);
    mobileApi.getMarketPriceRange(latitude, longitude, landUsage, roadAccess, controller.signal, area, areaUnit)
      .then(result => { if (current) setRange(result.range); })
      .catch(() => { if (current) setError(true); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [latitude, longitude, landUsage, roadAccess, area, areaUnit, retry, liveMarketComps]);

  const money = (value: number) => displayUnit === 'Cent' ? formatLakhs(value) : `₹${Math.round(value).toLocaleString('en-IN')}`;

  if (liveMarketComps && liveMarketComps.minPricePerCentLakhs > 0) {
    const lowPerCent = liveMarketComps.minPricePerCentLakhs * 100000;
    const highPerCent = liveMarketComps.maxPricePerCentLakhs * 100000;
    const lowSqFt = Math.round(lowPerCent / 435.6);
    const highSqFt = Math.round(highPerCent / 435.6);
    const low = displayUnit === 'Cent' ? lowPerCent : lowSqFt;
    const high = displayUnit === 'Cent' ? highPerCent : highSqFt;
    const locationStr = cleanAddress(liveMarketComps.resolvedLocality);

    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>INDICATIVE MARKET RANGE</Text>
        <Text style={styles.rate}>
          {money(low)} – {money(high)}
          <Text style={styles.unit}> / {displayUnit === 'Cent' ? 'cent' : 'sq ft'}</Text>
        </Text>
        <Text style={styles.location}>{locationStr}</Text>
        <Text style={styles.body}>Prevailing indicative market rates grounded across active portal listings.</Text>
      </View>
    );
  }

  if (loading) return <View style={styles.card}><ActivityIndicator color="#290444" /><Text style={styles.body}>Checking available pricing…</Text></View>;
  if (error) return <View style={styles.card}><Text style={styles.body}>Pricing is temporarily unavailable.</Text><TouchableOpacity accessibilityRole="button" onPress={() => setRetry(x => x + 1)} style={styles.retryButton}><Text style={styles.retry}>Retry pricing</Text></TouchableOpacity></View>;
  if (!range) return <View style={styles.empty}><Text style={styles.location}>Price unavailable</Text><Text style={styles.body}>A price range is not available for this property yet.</Text></View>;

  const low = displayUnit === 'Cent' ? range.lowPerCent : range.lowPerSqFt;
  const high = displayUnit === 'Cent' ? range.highPerCent : range.highPerSqFt;
  const locationStr = cleanAddress(`${range.locality}, ${range.district}`);

  return <View style={styles.card}>
    <Text style={styles.eyebrow}>INDICATIVE MARKET RANGE</Text>
    <Text style={styles.rate}>{money(low)} – {money(high)}<Text style={styles.unit}> / {displayUnit === 'Cent' ? 'cent' : 'sq ft'}</Text></Text>
    <Text style={styles.location}>{locationStr}</Text>
    <Text style={styles.body}>Prevailing indicative market rates and locality benchmarks.</Text>
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 20, backgroundColor: '#FFFFFF', borderColor: '#DED0EE', borderWidth: 1, borderRadius: 16, marginBottom: 16, gap: 8 },
  empty: { gap: 7, padding: 14, borderRadius: 12, backgroundColor: '#F0F2F7', marginBottom: 16 },
  eyebrow: { fontSize: 10, letterSpacing: .8, fontWeight: '800', color: '#604074' },
  rate: { fontSize: 25, lineHeight: 34, fontWeight: '800', fontVariant: ['tabular-nums'], color: '#290444' },
  unit: { fontSize: 13, fontWeight: '500' },
  location: { fontSize: 14, fontWeight: '700', color: '#382646' },
  body: { fontSize: 13, lineHeight: 20, color: '#61566C' },
  retryButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retry: { color: '#290444', fontSize: 14, fontWeight: '600', paddingVertical: 8 },
});
