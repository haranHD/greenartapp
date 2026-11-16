import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { BrokerPriceRange, mobileApi } from '../services/api';
import { formatLakhs } from '../utils/formatters';

export function BrokerPriceRangeCard({ latitude, longitude, landUsage, roadAccess, displayUnit }: {
  latitude: number; longitude: number; landUsage: number; roadAccess: string; displayUnit: 'Cent' | 'SqFt';
}) {
  const [range, setRange] = useState<BrokerPriceRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let current = true;
    setRange(null); setLoading(true); setError(false);
    mobileApi.getBrokerPriceRange(latitude, longitude, landUsage, roadAccess, controller.signal)
      .then(result => { if (current) setRange(result.range); })
      .catch(() => { if (current) setError(true); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [latitude, longitude, landUsage, roadAccess, retry]);
  if (loading) return <View style={styles.card}><ActivityIndicator color="#290444" /><Text style={styles.body}>Checking broker-reviewed pricing…</Text></View>;
  if (error) return <View style={styles.card}><Text style={styles.body}>Broker-reviewed pricing is temporarily unavailable.</Text><TouchableOpacity accessibilityRole="button" onPress={() => setRetry(x => x + 1)}><Text style={styles.retry}>Retry broker pricing</Text></TouchableOpacity></View>;
  if (!range) return <View style={styles.empty}><Text style={styles.body}>No current broker-reviewed range for this location, land type and road access yet.</Text></View>;
  const low = displayUnit === 'Cent' ? range.lowPerCent : range.lowPerSqFt;
  const high = displayUnit === 'Cent' ? range.highPerCent : range.highPerSqFt;
  const money = (value: number) => displayUnit === 'Cent' ? formatLakhs(value) : `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return <View style={styles.card}>
    <Text style={styles.eyebrow}>BROKER-REVIEWED MARKET ESTIMATE</Text>
    <Text style={styles.rate}>{money(low)} – {money(high)}<Text style={styles.unit}> / {displayUnit === 'Cent' ? 'cent' : 'sq ft'}</Text></Text>
    <Text style={styles.location}>{range.locality}, {range.district}</Text>
    <Text style={styles.body}>{range.observationCount} local {range.observationCount === 1 ? 'observation' : 'observations'} · {range.coverageRadiusMeters} m coverage</Text>
    <Text style={styles.body}>Observed {new Date(range.reviewedAtUtc).toLocaleDateString('en-IN')} · Valid until {new Date(range.validUntilUtc).toLocaleDateString('en-IN')}</Text>
    <Text style={styles.notice}>Indicative range checked with a local broker and approved for publication. Not a registered-sale valuation or a guaranteed transaction price.</Text>
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 20, backgroundColor: '#FFFFFF', borderColor: '#DED0EE', borderWidth: 1, borderRadius: 8, marginBottom: 16, gap: 8 },
  empty: { padding: 14, borderRadius: 12, backgroundColor: '#F0F2F7', marginBottom: 16 },
  eyebrow: { fontSize: 10, letterSpacing: .8, fontWeight: '800', color: '#604074' },
  rate: { fontSize: 25, lineHeight: 34, fontWeight: '800', color: '#290444' },
  unit: { fontSize: 13, fontWeight: '500' },
  location: { fontSize: 14, fontWeight: '700', color: '#382646' },
  body: { fontSize: 13, lineHeight: 20, color: '#61566C' },
  notice: { fontSize: 12, lineHeight: 19, color: '#61566C', borderTopWidth: 1, borderTopColor: '#DED0EE', paddingTop: 10, marginTop: 4 },
  retry: { color: '#290444', fontSize: 13, fontWeight: '700', paddingVertical: 8 },
});
