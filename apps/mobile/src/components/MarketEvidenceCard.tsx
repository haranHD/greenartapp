import React, { useState } from 'react';
import { View, StyleSheet, Linking, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { AppText as Text } from './AppText';
import { PremiumPressable } from './PremiumPressable';
import { ScreenEntrance } from './ScreenEntrance';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { LiveMarketCompsDto } from '../services/api';
import { Premium as P } from '../theme/premium';
import { cleanAddress } from './BrokerPriceRangeCard';

function publicLink(value: string) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function MarketEvidenceCard({ data, displayUnit }: { data: LiveMarketCompsDto; displayUnit: 'Cent' | 'SqFt' }) {
  const { width } = useWindowDimensions();
  const compact = width < 370;
  const { reduced } = useReducedMotion();
  const [linkError, setLinkError] = useState('');
  const listing = data.isLiveSearchGrounded === true;
  const validRange = Number.isFinite(data.minPricePerCentLakhs) && Number.isFinite(data.maxPricePerCentLakhs) && data.minPricePerCentLakhs > 0 && data.maxPricePerCentLakhs >= data.minPricePerCentLakhs;
  const cent = (n: number) => `₹${n.toFixed(2)}L`;
  const sqft = (n: number) => `₹${Math.round(n * 100000 / 435.6).toLocaleString('en-IN')}`;
  const roads = [...new Set((data.keyLandmarksUsed || []).filter(v => v && !/taluk|sublocality|^locality$|selected pin|neighborhood|administrative_area/i.test(v)))];
  const citations = listing ? (data.citations || []).map(c => ({ ...c, link: publicLink(c.url) })).filter(c => c.link) : [];
  return <ScreenEntrance><View style={[s.card, compact && { padding: 16 }]}>
    <View style={s.header}><View style={s.headingGroup}><Feather name="layers" size={18} color="#047857" /><Text style={s.heading}>Market Evidence</Text></View>
      <View style={s.badge}><View style={s.dot} /><Text style={s.badgeText}>{listing ? 'Listing-based' : 'Benchmark'}</Text></View></View>
    {!!data.microMarketTier && <View style={s.tier}><Text style={s.tierText}>{data.microMarketTier}</Text></View>}
    {validRange && <View style={s.panel}><Text style={s.panelLabel}>{listing ? 'Observed asking-price range' : 'Indicative benchmark range'}</Text>
      <Text style={s.price}>{displayUnit === 'Cent' ? `${cent(data.minPricePerCentLakhs)} – ${cent(data.maxPricePerCentLakhs)}` : `${sqft(data.minPricePerCentLakhs)} – ${sqft(data.maxPricePerCentLakhs)}`}<Text style={s.unit}> {'/\u00a0'}{displayUnit === 'Cent' ? 'cent' : 'sq\u00a0ft'}</Text></Text>
      <Text style={s.conversion}>{displayUnit === 'Cent' ? `${sqft(data.minPricePerCentLakhs)} – ${sqft(data.maxPricePerCentLakhs)} / sq ft` : `${cent(data.minPricePerCentLakhs)} – ${cent(data.maxPricePerCentLakhs)} / cent`}</Text>
      <Text style={s.helper}>1 cent = 435.6 sq ft</Text></View>}
    {!!data.resolvedLocality && <View style={s.location}><Feather name="map-pin" size={16} color="#047857" /><Text style={s.locationText}>{cleanAddress(data.resolvedLocality)}</Text></View>}
    {roads.length > 0 && <View style={s.chips}>{roads.map(road => <View key={road} style={s.chip}><Text style={s.chipText}>{road}</Text></View>)}</View>}
    {!!data.sourceSummary && <View style={s.summary}><Text style={s.body}>{data.sourceSummary}</Text></View>}
    <Text style={s.helper}>{listing ? 'Advertised asking prices; not verified sale transactions or a guaranteed sale price.' : 'Guideline benchmark; not a completed-sale valuation.'}</Text>
    {citations.length > 0 && <View style={s.sources}><View style={s.sourceHeading}><Feather name="link" size={13} color={P.secondary} /><Text style={s.sourceLabel}>PROPERTY PORTAL SOURCES</Text></View>
      {citations.map((c, i) => <PremiumPressable key={`${c.link}-${i}`} reducedMotion={reduced} accessibilityLabel={`Open ${c.title || c.portal}`} style={s.source} onPress={() => { setLinkError(''); void Linking.openURL(c.link!).catch(() => setLinkError('This source could not be opened. Please try again.')); }}>
        <View style={s.sourceCopy}><Text style={s.sourceTitle}>{c.title || c.portal || 'Property listing'}</Text><Text style={s.publisher}>{c.portal || new URL(c.link!).hostname}</Text></View><Feather name="external-link" size={16} color="#047857" />
      </PremiumPressable>)}
      {!!linkError && <Text accessibilityRole="alert" style={s.body}>{linkError}</Text>}
    </View>}
  </View></ScreenEntrance>;
}
const s = StyleSheet.create({
  card: { padding: 20, gap: 16, backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderLeftWidth: 3, borderLeftColor: '#047857', borderRadius: 22, shadowColor: P.violet, shadowOpacity: .04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headingGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 }, heading: { color: P.text, fontSize: 18, lineHeight: 26, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FDF4', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#047857' }, badgeText: { color: '#065F46', fontSize: 11, fontWeight: '600' },
  tier: { alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: P.lavender, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 }, tierText: { fontSize: 11, lineHeight: 17, color: P.purple, fontWeight: '600' },
  panel: { padding: 15, gap: 7, backgroundColor: '#F0FDF4', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: 14 }, panelLabel: { color: '#065F46', fontSize: 12, fontWeight: '600' }, price: { color: '#065F46', fontSize: 24, lineHeight: 34, fontWeight: '700', flexShrink: 1 }, unit: { fontSize: 12, fontWeight: '500' }, conversion: { fontSize: 12, lineHeight: 19, fontWeight: '600', color: '#047857' },
  helper: { fontSize: 11, lineHeight: 18, color: P.secondary }, location: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 }, locationText: { flex: 1, fontSize: 13, lineHeight: 21, color: P.text, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, chip: { maxWidth: '100%', backgroundColor: P.background, borderColor: P.border, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6 }, chipText: { color: P.secondary, fontSize: 11, lineHeight: 17 },
  summary: { borderLeftColor: '#047857', borderLeftWidth: 2, backgroundColor: P.background, padding: 12, borderRadius: 8 }, body: { color: P.secondary, fontSize: 12, lineHeight: 20 },
  sources: { borderTopColor: P.border, borderTopWidth: 1, paddingTop: 15, gap: 8 }, sourceHeading: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }, sourceLabel: { fontSize: 10, lineHeight: 17, letterSpacing: .6, color: P.secondary, fontWeight: '600' },
  source: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: P.background, borderColor: P.border, borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 62 }, sourceCopy: { flex: 1, minWidth: 0, gap: 3 }, sourceTitle: { fontSize: 13, lineHeight: 20, color: P.text, fontWeight: '600' }, publisher: { fontSize: 11, lineHeight: 17, color: '#047857' },
});
