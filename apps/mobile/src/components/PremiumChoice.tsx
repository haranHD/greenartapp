import React, { useEffect, useRef } from 'react';
import { Animated, Platform, TouchableOpacity } from 'react-native';
import { Premium as P } from '../theme/premium';
import { useReducedMotion } from '../hooks/useReducedMotion';

export function PremiumChoice({ label, selected, onPress, variant = 'chip' }: {
  label: string; selected: boolean; onPress: () => void; variant?: 'chip' | 'segment';
}) {
  const { reduced } = useReducedMotion();
  const value = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    value.stopAnimation();
    if (reduced) { value.setValue(selected ? 1 : 0); return; }
    const animation = Animated.timing(value, { toValue: selected ? 1 : 0, duration: 200, useNativeDriver: false });
    animation.start(); return () => animation.stop();
  }, [selected, reduced, value]);
  const segment = variant === 'segment';
  return <Animated.View style={{ flex: segment ? 1 : undefined, minWidth: 0, borderRadius: 11, borderWidth: 1,
    backgroundColor: value.interpolate({ inputRange: [0, 1], outputRange: [P.lavender, segment ? P.surface : P.violet] }),
    borderColor: value.interpolate({ inputRange: [0, 1], outputRange: [segment ? P.lavender : P.border, segment ? P.border : P.gold] }),
  }}><TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} {...(Platform.OS === 'web' ? { 'aria-pressed': selected } : {})}
    onPress={onPress} activeOpacity={.8} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: segment ? 8 : 13, paddingVertical: 10 }}>
    <Animated.Text style={{ fontSize: 12, lineHeight: 19, textAlign: 'center', fontWeight: selected ? '700' : '600', color: value.interpolate({ inputRange: [0, 1], outputRange: [P.secondary, segment ? P.violet : '#FFFFFF'] }) }}>{label}</Animated.Text>
  </TouchableOpacity></Animated.View>;
}
