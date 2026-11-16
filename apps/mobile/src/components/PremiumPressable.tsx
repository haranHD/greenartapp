import React, { ReactNode, useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity } from 'react-native';
import { Premium } from '../theme/premium';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityState?: { disabled?: boolean; busy?: boolean; selected?: boolean; expanded?: boolean; checked?: boolean };
  style?: object;
  containerStyle?: object;
  reducedMotion: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  highlight?: boolean;
}
/** Shared, non-blocking press feedback; reduced motion gets immediate visual feedback. */
export function PremiumPressable({ children, onPress, style, containerStyle, reducedMotion, accessibilityLabel, accessibilityHint, highlight = false, disabled = false, accessibilityState }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => () => progress.stopAnimation(), [progress]);
  useEffect(() => { if (reducedMotion) { progress.stopAnimation(); progress.setValue(0); } }, [reducedMotion, progress]);
  const feedback = (pressed: boolean) => {
    progress.stopAnimation();
    if (reducedMotion) { progress.setValue(pressed ? 1 : 0); return; }
    Animated.timing(progress, { toValue: pressed ? 1 : 0, duration: pressed ? 110 : 170, useNativeDriver: true }).start();
  };
  return <Animated.View style={[containerStyle, { transform: [{ scale: reducedMotion ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [1, .985] }) }] }]}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint} onPress={onPress}
      disabled={disabled} accessibilityState={{ ...accessibilityState, disabled }}
      onPressIn={() => feedback(true)} onPressOut={() => feedback(false)} activeOpacity={.92} style={[style, disabled && { opacity: .55 }]}>
      {highlight && <Animated.View pointerEvents="none" style={[styles.highlight, { opacity: progress }]} />}
      {children}
    </TouchableOpacity>
  </Animated.View>;
}
const styles = StyleSheet.create({
  highlight: { position: 'absolute', top: -1, bottom: -1, left: -1, right: -1, borderWidth: 1, borderRadius: 16, borderColor: Premium.gold, backgroundColor: 'rgba(245,240,250,.35)', shadowColor: Premium.gold, shadowOffset: { width: 0, height: 1 }, shadowRadius: 6, shadowOpacity: .08 },
});
