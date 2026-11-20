import { AppText as Text } from './AppText';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Keyboard, Platform, View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Typography } from '../theme/typography';
import { Colors } from '../theme/colors';

export type MobileTab = 'home' | 'marketplace' | 'estimate' | 'sell' | 'profile' | 'search' | 'history' | 'records' | 'guideline';
export interface FloatingBottomNavProps { activeTab: MobileTab; onSelectTab: (tab: MobileTab) => void; bottomInset: number; }
const palette = { dark: '#160026', primary: Colors.primary, secondary: '#3C096C', active: '#F5C76A', metallic: Colors.gold, muted: '#C6B7D6', border: '#51316B' };
const BAR_HEIGHT = 72;
export const getBottomNavClearance = (bottomInset: number) => BAR_HEIGHT + Math.max(bottomInset, 12) + 12;
const tabs = [
  { id: 'home', label: 'Home', accessibility: 'Home', icon: 'home' },
  { id: 'marketplace', label: 'Properties', accessibility: 'Browse properties', icon: 'map' },
  { id: 'estimate', label: 'Valuation', accessibility: 'Estimate land value', icon: 'bar-chart-2' },
  { id: 'sell', label: 'Sell', accessibility: 'Sell land', icon: 'plus-square' },
  { id: 'profile', label: 'Account', accessibility: 'Your profile', icon: 'user' },
] as const;
type NavItem = typeof tabs[number];

// Narrow tonal steps give native and web the same restrained gradient, without a new library.
const gradientBands = Array.from({ length: 24 }, (_, index) => {
  const amount = index / 23;
  return { top: `${index * 100 / 24}%`, height: '4.3%', color: `rgb(${Math.round(22 + 14 * amount)},0,${Math.round(38 + 32 * amount)})` };
});

function NavButton({ tab, active, reducedMotion, isCompact, onSelect }: { tab: NavItem; active: boolean; reducedMotion: boolean; isCompact: boolean; onSelect: (tab: MobileTab) => void }) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    progress.stopAnimation();
    if (reducedMotion) { progress.setValue(active ? 1 : 0); return; }
    const animation = Animated.timing(progress, { toValue: active ? 1 : 0, duration: 225, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start(); return () => animation.stop();
  }, [active, reducedMotion, progress]);
  const press = (pressed: boolean) => {
    pressScale.stopAnimation();
    if (reducedMotion) { pressScale.setValue(1); return; }
    Animated.timing(pressScale, { toValue: pressed ? .97 : 1, duration: 100, useNativeDriver: false }).start();
  };
  const iconSize = isCompact ? 19 : 22;
  const labelStyle = isCompact ? [styles.label, { fontSize: 9, letterSpacing: -0.2 }] : styles.label;
  const activeLabelStyle = isCompact ? [styles.activeLabel, { fontSize: 9, letterSpacing: -0.2 }] : styles.activeLabel;

  return <TouchableOpacity {...(Platform.OS === 'web' ? { 'aria-current': active ? 'page' : undefined } : {})} accessibilityRole="button" accessibilityLabel={tab.accessibility} accessibilityState={{ selected: active }}
    onPress={() => onSelect(tab.id)} onPressIn={() => press(true)} onPressOut={() => press(false)} activeOpacity={.9} style={[styles.touchTarget, isCompact && { marginHorizontal: 1, minHeight: 48 }]}>
    <Animated.View pointerEvents="none" style={[styles.item, isCompact && { minHeight: 48, gap: 3 }, { transform: [{ scale: pressScale }] }]}>
      <Animated.View style={[styles.activeBackground, { opacity: progress }]} />
      <Animated.View style={[styles.icon, isCompact && { width: 20, height: 20 }, { transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] }]}>
        <Feather accessible={false} name={tab.icon} size={iconSize} color={palette.muted} />
        <Animated.View style={[styles.iconOverlay, { opacity: progress }]}><Feather accessible={false} name={tab.icon} size={iconSize} color={palette.active} /></Animated.View>
      </Animated.View>
      <View style={styles.labelBox}>
        <Text numberOfLines={1} style={labelStyle}>{tab.label}</Text>
        <Animated.Text numberOfLines={1} style={[activeLabelStyle, { opacity: progress }]}>{tab.label}</Animated.Text>
      </View>
    </Animated.View>
  </TouchableOpacity>;
}

export function FloatingBottomNav({ activeTab, onSelectTab, bottomInset }: FloatingBottomNavProps) {
  const selected = ['search', 'records', 'guideline'].includes(activeTab) ? 'estimate' : activeTab === 'history' ? 'profile' : activeTab;
  const { width, fontScale } = useWindowDimensions();
  const isCompact = width < 365 || width / fontScale < 370;
  const isTablet = width >= 768;

  // Start without motion until the platform's accessibility preference has been read.
  const [reducedMotion, setReducedMotion] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    let current = true;
    if (Platform.OS === 'web') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReducedMotion(media.matches);
      update(); media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled: boolean) => { if (current) setReducedMotion(enabled); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { current = false; motion.remove(); show.remove(); hide.remove(); };
  }, []);
  if (keyboardVisible) return null;
  const barHeight = isCompact ? 64 : BAR_HEIGHT;

  return <View {...(Platform.OS === 'web' ? { role: 'navigation', 'aria-label': 'Main navigation' } : {})} pointerEvents="box-none" style={[styles.wrapper, { bottom: Math.max(bottomInset, 12) }]}>
    <View style={[styles.shadowFrame, isTablet && { maxWidth: 560 }]}>
      <View style={[styles.bar, { height: barHeight }, isCompact && { paddingHorizontal: 4 }]}>
        <View pointerEvents="none" style={styles.gradient}>{gradientBands.map((band, index) => <View key={index} style={{ position: 'absolute', left: 0, right: 0, top: band.top, height: band.height, backgroundColor: band.color }} />)}</View>
        <View pointerEvents="none" style={styles.topReflection} />
        {tabs.map(tab => <NavButton key={tab.id} tab={tab} active={selected === tab.id} reducedMotion={reducedMotion} isCompact={isCompact} onSelect={onSelectTab} />)}
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 100 },
  shadowFrame: { width: '100%', maxWidth: 640, borderRadius: 22, backgroundColor: palette.dark, shadowColor: '#160026', shadowOffset: { width: 0, height: 5 }, shadowOpacity: .2, shadowRadius: 12, elevation: 8, ...(Platform.OS === 'web' ? { boxShadow: '0 5px 18px rgba(22,0,38,.19)' } : {}) },
  bar: { height: BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, borderRadius: 22, borderWidth: 1, borderColor: palette.border, overflow: 'hidden' },
  gradient: { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 },
  topReflection: { position: 'absolute', top: 0, left: 22, right: 22, height: 1, backgroundColor: 'rgba(245,199,106,.12)' },
  touchTarget: { flex: 1, minWidth: 0, minHeight: 56, marginHorizontal: 2, borderRadius: 15 },
  item: { minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 5 },
  activeBackground: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 15, backgroundColor: palette.secondary, borderWidth: 1, borderColor: 'rgba(245,199,106,.15)', shadowColor: palette.metallic, shadowOffset: { width: 0, height: 0 }, shadowOpacity: .12, shadowRadius: 6, ...(Platform.OS === 'web' ? { boxShadow: '0 0 9px rgba(212,175,55,.08), inset 0 1px 0 rgba(245,199,106,.06)' } : {}) },
  icon: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center' },
  iconOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  labelBox: { alignItems: 'center', justifyContent: 'center', minHeight: 15, alignSelf: 'stretch' },
  label: { ...Typography.nav, color: palette.muted },
  activeLabel: { ...Typography.nav, position: 'absolute', color: palette.active },
});
