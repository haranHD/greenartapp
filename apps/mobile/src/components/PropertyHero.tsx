import { AppText as Text } from './AppText';
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Fonts } from '../theme/typography';
import { Premium } from '../theme/premium';

// Bundled decorative artwork with a local gradient fallback; never a property listing image.
const tones = Array.from({ length: 30 }, (_, index) => {
  const t = index / 29;
  return `rgb(${Math.round(36 + 24 * t)},${Math.round(9 * t)},${Math.round(70 + 38 * t)})`;
});
export function PropertyHero({ wide, compact }: { wide: boolean; compact: boolean }) {
  return <View style={[styles.card, wide && styles.wide]}>
    <View pointerEvents="none" accessible={false} style={styles.decoration}>
      {tones.map((backgroundColor, i) => <View key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${i * 100 / tones.length}%`, width: '3.5%', backgroundColor }} />)}
      <Image accessible={false} source={require('../../assets/property-hero-v1.jpg')} style={styles.propertyImage} resizeMode="cover" />
      {tones.slice(0, 20).map((_, i) => <View key={`shade-${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${i * 4}%`, width: '4.2%', backgroundColor: '#240046', opacity: .7 * (1 - i / 20) }} />)}
      <View style={styles.goldWave} /><View style={styles.goldLine} />
    </View>
    <View style={styles.content}>
      <View style={styles.eyebrowRow}><View style={styles.eyebrowLine} /><Text style={styles.eyebrow}>PROPERTY INTELLIGENCE</Text></View>
      <Text style={[styles.heading, wide && styles.headingWide, compact && styles.headingCompact]}>Understand the value.{'\n'}<Text style={styles.accent}>Know the evidence.</Text></Text>
      <Text style={styles.description}>Look up a location, compare local prices, and review the supporting records.</Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: Premium.violet, borderRadius: 18, padding: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#492565', shadowColor: Premium.violet, shadowOffset: { width: 0, height: 5 }, shadowOpacity: .09, shadowRadius: 12, elevation: 2 },
  wide: { flex: 1, minHeight: 300, padding: 32, justifyContent: 'center' },
  decoration: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  goldLine: { position: 'absolute', bottom: 0, left: 24, width: 42, height: 2, backgroundColor: Premium.gold },
  propertyImage: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, width: '100%', height: '100%' },
  goldWave: { position: 'absolute', bottom: -28, left: -26, width: 260, height: 37, borderTopWidth: 2, borderColor: '#D4AF37', borderRadius: 100, transform: [{ rotate: '-5deg' }] },
  content: { gap: 10 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrowLine: { width: 14, height: 1, backgroundColor: Premium.champagne },
  eyebrow: { color: Premium.champagne, fontSize: 10, lineHeight: 16, fontWeight: '700', letterSpacing: .9, flexShrink: 1 },
  heading: { fontFamily: Fonts.editorial, fontSize: 28, lineHeight: 35, textShadowColor: 'rgba(22,0,38,.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3, fontWeight: '600', color: '#FFFFFF', letterSpacing: -.3 },
  headingWide: { fontSize: 30, lineHeight: 39 },
  headingCompact: { fontSize: 26, lineHeight: 34 },
  accent: { color: Premium.champagne },
  description: { color: '#E6DDED', fontSize: 13, lineHeight: 20, maxWidth: '73%' },
});
