import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Premium } from '../theme/premium';

// Local gradient fallback: no external images, invented property listings or asset licences.
const tones = Array.from({ length: 30 }, (_, index) => {
  const t = index / 29;
  return `rgb(${Math.round(36 + 24 * t)},${Math.round(9 * t)},${Math.round(70 + 38 * t)})`;
});
export function PropertyHero({ wide, compact }: { wide: boolean; compact: boolean }) {
  return <View style={[styles.card, wide && styles.wide]}>
    <View pointerEvents="none" accessible={false} style={styles.decoration}>
      {tones.map((backgroundColor, i) => <View key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${i * 100 / tones.length}%`, width: '3.5%', backgroundColor }} />)}
      <View style={styles.planOuter} /><View style={styles.planInner} /><View style={styles.goldLine} />
    </View>
    <View style={styles.content}>
      <View style={styles.eyebrowRow}><View style={styles.eyebrowLine} /><Text style={styles.eyebrow}>PROPERTY INTELLIGENCE</Text></View>
      <Text style={[styles.heading, wide && styles.headingWide, compact && styles.headingCompact]}>Understand the value.{'\n'}<Text style={styles.accent}>Know the evidence.</Text></Text>
      <Text style={styles.description}>Look up a location, compare local prices, and review the supporting records.</Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: Premium.violet, borderRadius: 22, padding: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#492565', shadowColor: Premium.violet, shadowOffset: { width: 0, height: 5 }, shadowOpacity: .09, shadowRadius: 12, elevation: 2 },
  wide: { flex: 1, minHeight: 330, padding: 32, justifyContent: 'center' },
  decoration: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  planOuter: { position: 'absolute', width: 192, height: 228, right: -86, bottom: -110, borderWidth: 1, borderColor: 'rgba(245,199,106,.14)', borderRadius: 28, transform: [{ rotate: '-22deg' }] },
  planInner: { position: 'absolute', width: 148, height: 180, right: -63, bottom: -91, borderWidth: 1, borderColor: 'rgba(245,199,106,.1)', borderRadius: 20, transform: [{ rotate: '-22deg' }] },
  goldLine: { position: 'absolute', bottom: 0, left: 24, width: 42, height: 2, backgroundColor: Premium.gold },
  content: { gap: 14 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrowLine: { width: 14, height: 1, backgroundColor: Premium.champagne },
  eyebrow: { color: Premium.champagne, fontSize: 10, lineHeight: 16, fontWeight: '700', letterSpacing: .9, flexShrink: 1 },
  heading: { fontSize: 27, lineHeight: 35, fontWeight: '700', color: '#FFFFFF', letterSpacing: -.7 },
  headingWide: { fontSize: 33, lineHeight: 43 },
  headingCompact: { fontSize: 24, lineHeight: 32 },
  accent: { color: Premium.champagne },
  description: { color: '#E6DDED', fontSize: 13, lineHeight: 21, maxWidth: 430 },
});
