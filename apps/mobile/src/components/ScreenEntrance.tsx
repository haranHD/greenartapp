import React, { ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
export function ScreenEntrance({ children, style }: { children: ReactNode; style?: object }) {
  const { ready, reduced } = useReducedMotion();
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!ready || reduced) { value.setValue(1); return; }
    value.setValue(.97);
    const animation = Animated.timing(value, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [ready, reduced, value]);
  return <Animated.View style={[{ gap: 18, opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [.97, 1], outputRange: [4, 0], extrapolate: 'clamp' }) }] }, style]}>{children}</Animated.View>;
}
