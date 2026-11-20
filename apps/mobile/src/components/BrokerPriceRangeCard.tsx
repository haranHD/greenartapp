import { AppText as Text } from './AppText';
import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import { MarketPriceRange, LiveMarketCompsDto, mobileApi } from '../services/api';
import Feather from '@expo/vector-icons/Feather';
import { ScreenEntrance } from './ScreenEntrance';
import { Premium as P } from '../theme/premium';
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

function PriceHero({ low, high, location, explanation, displayUnit }: { low: number; high: number; location: string; explanation: string; displayUnit: 'Cent' | 'SqFt' | 'Acre' }) {
  const { width, fontScale } = useWindowDimensions();
  const isSmall = width < 350;
  const compact = isSmall || width / fontScale < 375;
  const rateFontSize = isSmall ? 20 : compact ? 22 : 26;
  const rateLineHeight = isSmall ? 28 : compact ? 30 : 36;
  const money = (value: number) => {
    if (displayUnit === 'Acre') {
      if (value >= 10000000) {
        const cr = value / 10000000;
        return `₹${cr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00a0Cr`;
      }
      const lakhs = value / 100000;
      return `₹${lakhs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00a0L`;
    }
    if (displayUnit === 'Cent') {
      const lakhs = value >= 100000 ? value / 100000 : value;
      return `₹${lakhs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00a0L`;
    }
    return `₹${Math.round(value).toLocaleString('en-IN')}`;
  };
  const unitLabel = displayUnit === 'Cent' ? 'cent' : displayUnit === 'SqFt' ? 'sq\u00a0ft' : 'acre';
  return <ScreenEntrance><View style={[styles.hero, compact && { padding: 16 }]}>
    <View pointerEvents="none" accessible={false} style={styles.art}>
      <View style={styles.halo} />
      <View style={[styles.building, { right: 18, height: 55 }]} /><View style={[styles.building, { right: 43, height: 80 }]} /><View style={[styles.building, { right: 68, height: 43 }]} />
      <View style={styles.goldCurve} />
    </View>
    <Text style={styles.heroEyebrow}>INDICATIVE MARKET RANGE</Text>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.heroRate, { fontSize: rateFontSize, lineHeight: rateLineHeight }]}>
      {money(low)} – {money(high)}<Text style={styles.heroUnit}>{' /\u00a0'}{unitLabel}</Text>
    </Text>
    <View style={styles.heroLocationRow}><Feather name="map-pin" size={17} color={P.champagne} /><Text style={styles.heroLocation}>{location}</Text></View>
    <View style={styles.heroDivider} />
    <Text style={styles.heroBody}>{explanation}</Text>
  </View></ScreenEntrance>;
}

export function BrokerPriceRangeCard({ latitude, longitude, landUsage, roadAccess, displayUnit, area, areaUnit, liveMarketComps }: {
  latitude: number; longitude: number; landUsage: number; roadAccess: string; displayUnit: 'Cent' | 'SqFt' | 'Acre'; area?: number; areaUnit?: string;
  liveMarketComps?: LiveMarketCompsDto | null;
}) {
  const [range, setRange] = useState<MarketPriceRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (liveMarketComps && Number.isFinite(liveMarketComps.minPricePerCentLakhs) && Number.isFinite(liveMarketComps.maxPricePerCentLakhs) && liveMarketComps.minPricePerCentLakhs > 0 && liveMarketComps.maxPricePerCentLakhs >= liveMarketComps.minPricePerCentLakhs) {
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

  if (liveMarketComps && Number.isFinite(liveMarketComps.minPricePerCentLakhs) && Number.isFinite(liveMarketComps.maxPricePerCentLakhs) && liveMarketComps.minPricePerCentLakhs > 0 && liveMarketComps.maxPricePerCentLakhs >= liveMarketComps.minPricePerCentLakhs) {
    const lowPerCent = liveMarketComps.minPricePerCentLakhs * 100000;
    const highPerCent = liveMarketComps.maxPricePerCentLakhs * 100000;
    const lowSqFt = Math.round(lowPerCent / 435.6);
    const highSqFt = Math.round(highPerCent / 435.6);
    const lowAcre = Math.round((lowPerCent * 3 / 4) * 100);
    const highAcre = Math.round((highPerCent * 3 / 4) * 100);
    const low = displayUnit === 'Cent' ? lowPerCent : displayUnit === 'SqFt' ? lowSqFt : lowAcre;
    const high = displayUnit === 'Cent' ? highPerCent : displayUnit === 'SqFt' ? highSqFt : highAcre;
    const locationStr = cleanAddress(liveMarketComps.resolvedLocality);

    return <PriceHero low={low} high={high} location={locationStr} displayUnit={displayUnit}
      explanation={liveMarketComps.isLiveSearchGrounded === true ? 'Indicative asking prices from property listings. Not a guaranteed sale price.' : 'Indicative locality benchmark. Not a completed-sale valuation.'} />;
  }

  if (loading) return <View style={styles.card}><ActivityIndicator color="#290444" /><Text style={styles.body}>Checking available pricing…</Text></View>;
  if (error) return <View style={styles.card}><Text style={styles.body}>Pricing is temporarily unavailable.</Text><TouchableOpacity accessibilityRole="button" onPress={() => setRetry(x => x + 1)} style={styles.retryButton}><Text style={styles.retry}>Retry pricing</Text></TouchableOpacity></View>;
  if (!range) return <View style={styles.empty}><Text style={styles.location}>Price unavailable</Text><Text style={styles.body}>A price range is not available for this property yet.</Text></View>;

  const lowAcre = Math.round((range.lowPerCent * 3 / 4) * 100);
  const highAcre = Math.round((range.highPerCent * 3 / 4) * 100);
  const low = displayUnit === 'Cent' ? range.lowPerCent : displayUnit === 'SqFt' ? range.lowPerSqFt : lowAcre;
  const high = displayUnit === 'Cent' ? range.highPerCent : displayUnit === 'SqFt' ? range.highPerSqFt : highAcre;
  const locationStr = cleanAddress(`${range.locality}, ${range.district}`);

  return <PriceHero low={low} high={high} location={locationStr} displayUnit={displayUnit}
    explanation={range.basis === 'AiSuggested' ? 'Based on advertised asking prices. Broker verification pending.' : 'Broker-reviewed market opinion, approved for display.'} />;
}

const styles = StyleSheet.create({
  hero: { padding: 22, gap: 13, backgroundColor: P.violet, borderColor: P.richViolet, borderWidth: 1, borderRadius: 24, overflow: 'hidden', shadowColor: P.violet, shadowOpacity: .16, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  heroEyebrow: { color: P.champagne, fontSize: 10, lineHeight: 17, letterSpacing: 1.1, fontWeight: '600' },
  heroRate: { fontSize: 32, lineHeight: 45, color: P.surface, fontWeight: '700', flexShrink: 1 }, heroUnit: { fontSize: 13, fontWeight: '500', color: '#E9E2F0' },
  heroLocationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, heroLocation: { flex: 1, color: P.surface, fontSize: 14, lineHeight: 23, fontWeight: '600' },
  heroDivider: { height: 1, backgroundColor: 'rgba(233,226,240,.20)' }, heroBody: { color: '#E9E2F0', fontSize: 12, lineHeight: 21, paddingRight: 22 },
  art: { position: 'absolute', bottom: 0, right: 0, width: 160, height: 130, opacity: .18 }, halo: { position: 'absolute', width: 230, height: 230, borderRadius: 115, right: -110, bottom: -90, backgroundColor: P.purple },
  building: { position: 'absolute', width: 22, bottom: 10, borderWidth: 1, borderColor: P.champagne, borderTopWidth: 3 }, goldCurve: { position: 'absolute', width: 250, height: 90, borderRadius: 125, borderWidth: 2, borderColor: P.gold, right: -50, bottom: -65, transform: [{ rotate: '-12deg' }] },
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
