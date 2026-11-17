import { AppText as Text } from './AppText';
import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { MarketPriceRange, mobileApi } from '../services/api';
import { authService } from '../services/auth';
import { formatLakhs } from '../utils/formatters';

export function BrokerPriceRangeCard({ latitude, longitude, landUsage, roadAccess, displayUnit, locality, district }: {
  latitude: number; longitude: number; landUsage: number; roadAccess: string; displayUnit: 'Cent' | 'SqFt'; locality: string; district?: string;
}) {
  const [range, setRange] = useState<MarketPriceRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState('');
  const pending = useRef(false);
  const operation = useRef(0);
  const requestId = useRef('');
  const generate = async () => {
    if (pending.current) return;
    const token = authService.getAccessToken();
    if (!token) { setGenerationMessage('Sign in again to generate an AI suggestion.'); return; }
    pending.current = true; setGenerating(true); setGenerationMessage('');
    const current = operation.current;
    // An idempotency identifier, never an authentication credential.
    if (!requestId.current) requestId.current = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16);
    });
    try {
      const result = await mobileApi.generatePriceResearch({ requestId: requestId.current, locality,
        district: district?.trim() || 'Unspecified', latitude, longitude, landUsage, roadAccess }, token);
      if (operation.current === current) { requestId.current = ''; setRange(result.range); setGenerationMessage(result.message); }
    } catch (e: any) {
      if (operation.current === current) setGenerationMessage(e?.message || 'Research failed. Refresh saved pricing before retrying.');
    } finally {
      if (operation.current === current) { pending.current = false; setGenerating(false); }
    }
  };
  useEffect(() => {
    operation.current += 1; pending.current = false; setGenerating(false); setGenerationMessage('');
    const controller = new AbortController(); let current = true;
    setRange(null); setLoading(true); setError(null);
    mobileApi.getMarketPriceRange(latitude, longitude, landUsage, roadAccess, controller.signal)
      .then(result => { if (current) setRange(result.range); })
      .catch((e: any) => { if (current) setError(e?.message || 'Price research is temporarily unavailable.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; operation.current += 1; controller.abort(); };
  }, [latitude, longitude, landUsage, roadAccess, retry]);
  useEffect(() => { requestId.current = ''; }, [latitude, longitude, landUsage, roadAccess]);
  if (loading) return <View style={styles.card}><ActivityIndicator color="#290444" /><Text style={styles.body}>Checking available pricing…</Text></View>;
  if (error) return <View style={styles.card}><Text style={styles.body}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => setRetry(x => x + 1)}><Text style={styles.retry}>Retry pricing</Text></TouchableOpacity></View>;
  const refresh = <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh saved price range" disabled={generating} onPress={() => setRetry(x => x + 1)} style={styles.refresh}><Text style={styles.retry}>Refresh price</Text></TouchableOpacity>;
  if (!range) return <View style={styles.empty}><Text style={styles.location}>Price not available yet</Text><Text style={styles.body}>No saved AI suggestion or approved range matches this location, land type and road access.</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Generate AI suggestion" accessibilityState={{ disabled: generating, busy: generating }} disabled={generating} onPress={() => void generate()} style={[styles.generate, generating && { opacity: .65 }]}>
      {generating && <ActivityIndicator color="#FFFFFF" />}<Text style={styles.generateText}>{generating ? 'Generating suggestion…' : 'Generate AI suggestion'}</Text>
    </TouchableOpacity>
    <Text style={styles.body}>Uses API credits when new research is needed. Saved for admin review; not a verified market price.</Text>
    {!!generationMessage && <Text accessibilityRole="alert" style={styles.body}>{generationMessage}</Text>}
    {refresh}</View>;
  const aiSuggested = range.basis === 'AiSuggested';
  const low = displayUnit === 'Cent' ? range.lowPerCent : range.lowPerSqFt;
  const high = displayUnit === 'Cent' ? range.highPerCent : range.highPerSqFt;
  const money = (value: number) => displayUnit === 'Cent' ? formatLakhs(value) : `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return <View style={styles.card}>
    <Text style={styles.eyebrow}>{aiSuggested ? 'AI SUGGESTED RANGE' : 'BROKER-REVIEWED MARKET ESTIMATE'}</Text>
    <Text style={[styles.status, aiSuggested ? styles.pending : styles.approved]}>{aiSuggested ? 'Not yet verified · Awaiting admin review' : 'Broker checked · Admin approved'}</Text>
    <Text style={styles.rate}>{money(low)} – {money(high)}<Text style={styles.unit}> / {displayUnit === 'Cent' ? 'cent' : 'sq ft'}</Text></Text>
    <Text style={styles.location}>{range.locality}, {range.district}</Text>
    {aiSuggested ? <>
      <Text style={styles.body}>Saved AI research · {range.providers.join(', ')} · {range.coverageRadiusMeters} m coverage</Text>
      <Text style={styles.body}>Generated {range.generatedAtUtc ? new Date(range.generatedAtUtc).toLocaleDateString('en-IN') : '—'} · Valid until {new Date(range.validUntilUtc).toLocaleDateString('en-IN')}</Text>
    </> : <>
    <Text style={styles.body}>{range.observationCount} local {range.observationCount === 1 ? 'observation' : 'observations'} · {range.coverageRadiusMeters} m coverage</Text>
    <Text style={styles.body}>Observed {range.reviewedAtUtc ? new Date(range.reviewedAtUtc).toLocaleDateString('en-IN') : '—'} · Valid until {new Date(range.validUntilUtc).toLocaleDateString('en-IN')}</Text>
    </>}
    <Text style={styles.notice}>{range.notice}</Text>
    {!!generationMessage && <Text accessibilityLiveRegion="polite" style={styles.body}>{generationMessage}</Text>}
    {refresh}
  </View>;
}
const styles = StyleSheet.create({
  generate: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 11, backgroundColor: '#240046', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  generateText: { color: '#FFFFFF', fontSize: 14, lineHeight: 21, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  status: { fontSize: 11, lineHeight: 18, fontWeight: '600', alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, overflow: 'hidden' },
  pending: { color: '#885517', backgroundColor: '#FFF4D6' },
  approved: { color: '#21643A', backgroundColor: '#ECFDF3' },
  refresh: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  card: { padding: 20, backgroundColor: '#FFFFFF', borderColor: '#DED0EE', borderWidth: 1, borderRadius: 16, marginBottom: 16, gap: 8 },
  empty: { gap: 7, padding: 14, borderRadius: 12, backgroundColor: '#F0F2F7', marginBottom: 16 },
  eyebrow: { fontSize: 10, letterSpacing: .8, fontWeight: '800', color: '#604074' },
  rate: { fontSize: 25, lineHeight: 34, fontWeight: '800', color: '#290444' },
  unit: { fontSize: 13, fontWeight: '500' },
  location: { fontSize: 14, fontWeight: '700', color: '#382646' },
  body: { fontSize: 13, lineHeight: 20, color: '#61566C' },
  notice: { fontSize: 12, lineHeight: 19, color: '#61566C', borderTopWidth: 1, borderTopColor: '#DED0EE', paddingTop: 10, marginTop: 4 },
  retry: { color: '#290444', fontSize: 14, fontWeight: '600', paddingVertical: 8 },
});
