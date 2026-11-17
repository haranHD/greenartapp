import { Platform, StyleSheet } from 'react-native';
import { Typography } from './typography';
import { Premium as P } from './premium';

/** Shared presentation primitives for the remaining customer screens. */
export const ScreenUI = {
  canvas: { flex: 1, backgroundColor: P.background },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 20, gap: 18 },
  card: { backgroundColor: P.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: P.border, shadowColor: P.violet, shadowOffset: { width: 0, height: 3 }, shadowOpacity: .04, shadowRadius: 10, elevation: 1 },
  heading: { ...Typography.page, color: P.text, letterSpacing: -.5 },
  subtitle: { color: P.secondary, fontSize: 13, lineHeight: 21 },
  eyebrow: { color: '#82601B', fontSize: 10, lineHeight: 16, letterSpacing: .8, fontWeight: '700' },
  section: { color: P.violet, fontSize: 12, lineHeight: 19, fontWeight: '700', letterSpacing: .4 },
  input: { ...(Platform.OS === 'web' ? { outlineColor: P.highlight, outlineOffset: 2 } : {}), minHeight: 48, borderWidth: 1, borderColor: P.border, borderRadius: 11, backgroundColor: '#FDFCFE', paddingHorizontal: 13, paddingVertical: 12, color: P.text, fontSize: 14 },
  chip: { minHeight: 44, borderWidth: 1, borderColor: P.border, borderRadius: 11, backgroundColor: P.lavender, paddingHorizontal: 13, paddingVertical: 10, justifyContent: 'center' },
  chipActive: { backgroundColor: P.violet, borderColor: P.gold },
  chipText: { color: P.secondary, fontSize: 12, lineHeight: 19, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  primary: { minHeight: 48, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: P.violet, borderWidth: 1, borderColor: '#806032', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0, elevation: 0 },
  primaryText: { ...Typography.button, color: '#FFFFFF', textAlign: 'center' },
  secondary: { minHeight: 48, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: P.surface, borderWidth: 1, borderColor: '#DDD0E8', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { ...Typography.button, color: P.violet, textAlign: 'center' },
  segments: { flexDirection: 'row', backgroundColor: P.lavender, borderRadius: 13, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 46, paddingHorizontal: 8, paddingVertical: 11, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: P.surface, shadowColor: P.violet, shadowOffset: { width: 0, height: 1 }, shadowOpacity: .05, shadowRadius: 3, elevation: 1 },
  segmentText: { color: P.secondary, fontSize: 12, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
  segmentTextActive: { color: P.violet, fontWeight: '700' },
} as const;

/** Compose existing layout-specific styles with the common presentation primitives. */
export function withScreenStyles<T extends Record<string, object>>(base: T, overrides: Partial<Record<keyof T, object>>): T {
  return StyleSheet.create(Object.fromEntries(Object.entries(base).map(([key, value]) => [key, { ...value, ...overrides[key as keyof T] }]))) as T;
}
