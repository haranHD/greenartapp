import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Image,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface AnimatedMapLandingScreenProps {
  onAnimationComplete?: () => void;
  minDurationMs?: number;
  isReady?: boolean;
}

/**
 * Animated Map Landing & Loading Screen
 * Combines the Folded Accordion Route Map (Image 1) with the Location Pin (Image 2)
 * into a single unified, animated visual with bouncing pin, radar ripples, and road pulses.
 * Strictly presents clean institutional map visuals with ZERO brand text.
 */
export const AnimatedMapLandingScreen: React.FC<AnimatedMapLandingScreenProps> = ({
  onAnimationComplete,
  minDurationMs = 2400,
  isReady = true,
}) => {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const completionTriggeredRef = useRef(false);

  // Animation drivers
  const containerFadeAnim = useRef(new Animated.Value(0)).current;
  const mapFloatAnim = useRef(new Animated.Value(0)).current;
  const shadowScaleAnim = useRef(new Animated.Value(1)).current;
  const pinDropAnim = useRef(new Animated.Value(-35)).current;
  const pinHoverAnim = useRef(new Animated.Value(0)).current;
  const rippleAnim1 = useRef(new Animated.Value(0)).current;
  const rippleAnim2 = useRef(new Animated.Value(0)).current;
  const routePulseAnim = useRef(new Animated.Value(0)).current;
  const progressBarAnim = useRef(new Animated.Value(0)).current;
  const dot1Anim = useRef(new Animated.Value(0.3)).current;
  const dot2Anim = useRef(new Animated.Value(0.3)).current;
  const dot3Anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // 1. Initial fade-in of the entire screen
    Animated.timing(containerFadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    // 2. Initial Pin Drop-in with spring impact
    Animated.spring(pinDropAnim, {
      toValue: 0,
      tension: 60,
      friction: 5,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      // Once dropped, start the rhythmic hovering loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(pinHoverAnim, {
            toValue: -8,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pinHoverAnim, {
            toValue: 0,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      ).start();
    });

    // 3. Map Floating & Breathing Loop
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(mapFloatAnim, {
            toValue: -6,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(shadowScaleAnim, {
            toValue: 0.88,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
        Animated.parallel([
          Animated.timing(mapFloatAnim, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(shadowScaleAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      ])
    ).start();

    // 4. Radar / Ripple Waves under the pin
    const createRippleLoop = (anim: any, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
    };
    createRippleLoop(rippleAnim1, 0).start();
    createRippleLoop(rippleAnim2, 800).start();

    // 5. Route pulse along roads
    Animated.loop(
      Animated.sequence([
        Animated.timing(routePulseAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.linear),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(routePulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    ).start();

    // 6. Minimalist Progress Track Fill
    Animated.timing(progressBarAnim, {
      toValue: 1,
      duration: minDurationMs,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // 7. Triple Dot Pulse Loop
    Animated.loop(
      Animated.stagger(220, [
        Animated.sequence([
          Animated.timing(dot1Anim, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(dot1Anim, { toValue: 0.3, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
        ]),
        Animated.sequence([
          Animated.timing(dot2Anim, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(dot2Anim, { toValue: 0.3, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
        ]),
        Animated.sequence([
          Animated.timing(dot3Anim, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(dot3Anim, { toValue: 0.3, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
        ]),
      ])
    ).start();

    // 8. Minimum duration timer
    const completeTimer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDurationMs);

    return () => {
      clearTimeout(completeTimer);
    };
  }, [minDurationMs]);

  // Handle completion when both minimum animation time has elapsed and app is ready
  useEffect(() => {
    if (minTimeElapsed && isReady && !completionTriggeredRef.current) {
      completionTriggeredRef.current = true;
      if (onAnimationComplete) {
        Animated.timing(containerFadeAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: Platform.OS !== 'web',
        }).start(() => {
          onAnimationComplete();
        });
      }
    }
  }, [minTimeElapsed, isReady, onAnimationComplete]);

  // Ripple interpolations
  const ripple1Scale = rippleAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 2.5],
  });
  const ripple1Opacity = rippleAnim1.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.85, 0.4, 0],
  });

  const ripple2Scale = rippleAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 2.5],
  });
  const ripple2Opacity = rippleAnim2.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.85, 0.4, 0],
  });

  // Progress width
  const progressWidth = progressBarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Pin ground shadow interpolations based on hover height
  const pinShadowScale = pinHoverAnim.interpolate({
    inputRange: [-8, 0],
    outputRange: [0.7, 1.0],
  });
  const pinShadowOpacity = pinHoverAnim.interpolate({
    inputRange: [-8, 0],
    outputRange: [0.25, 0.55],
  });

  return (
    <Animated.View style={[styles.container, { opacity: containerFadeAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0E0B1F" />

      {/* Subtle Ambient Radial Glow */}
      <View style={styles.ambientGlow} />

      {/* Center Animated Icon Composition (Image 1 Folded Map + Image 2 Pin) */}
      <View style={styles.compositionWrapper}>
        {/* Soft Elliptical Drop Shadow Under Map */}
        <Animated.View
          style={[
            styles.mapShadow,
            {
              transform: [{ scale: shadowScaleAnim }],
            },
          ]}
        />

        {/* Floating Folded Map with Roads (Image 1) */}
        <Animated.View
          style={[
            styles.mapContainer,
            {
              transform: [{ translateY: mapFloatAnim }],
            },
          ]}
        >
          <Image
            source={require('../../assets/folded-map-routes.png')}
            style={styles.foldedMapImage}
            resizeMode="contain"
          />

          {/* Radar Ripple Waves on Map Surface (underneath Pin tip) */}
          <View style={styles.pinAnchorLocation}>
            <Animated.View
              style={[
                styles.rippleRing,
                styles.rippleRingGold,
                {
                  transform: [{ scale: ripple1Scale }],
                  opacity: ripple1Opacity,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.rippleRing,
                styles.rippleRingTeal,
                {
                  transform: [{ scale: ripple2Scale }],
                  opacity: ripple2Opacity,
                },
              ]}
            />
            {/* Soft Elliptical Ground Shadow under Pin tip */}
            <Animated.View
              style={[
                styles.pinTipShadow,
                {
                  transform: [{ scale: pinShadowScale }],
                  opacity: pinShadowOpacity,
                },
              ]}
            />
          </View>

          {/* Animated Location Pin (Image 2) - Clean container with NO box-shadow artifact */}
          <Animated.View
            style={[
              styles.locationPinWrapper,
              {
                transform: [
                  { translateY: pinDropAnim },
                  { translateY: pinHoverAnim },
                ],
              },
            ]}
          >
            <Image
              source={require('../../assets/location-pin-blue.png')}
              style={styles.locationPinImage}
              resizeMode="contain"
            />
          </Animated.View>
        </Animated.View>
      </View>

      {/* Minimalist Loading Bar & Pulsing Dots (NO BRAND NAME) */}
      <View style={styles.footerContainer}>
        {/* Sleek Progress Track */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
        </View>

        {/* Triple Sync Dots */}
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, { opacity: dot1Anim }]} />
          <Animated.View style={[styles.dot, { opacity: dot2Anim }]} />
          <Animated.View style={[styles.dot, { opacity: dot3Anim }]} />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0E0B1F', // Deep luxury midnight violet backdrop
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  ambientGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(212, 175, 55, 0.04)',
  },
  compositionWrapper: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mapShadow: {
    position: 'absolute',
    bottom: 4,
    width: 120,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  mapContainer: {
    width: 146,
    height: 146,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  foldedMapImage: {
    width: 146,
    height: 146,
  },
  // Anchor position on the folded map (centered coordinate for pin tip contact & ripples)
  pinAnchorLocation: {
    position: 'absolute',
    top: 61,
    left: 61,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTipShadow: {
    position: 'absolute',
    width: 14,
    height: 4,
    borderRadius: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  rippleRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  rippleRingGold: {
    borderColor: '#D4AF37',
  },
  rippleRingTeal: {
    borderColor: '#2DD4BF',
  },
  // Centered wrapper for location pin with ZERO box-shadow or square border artifacts
  locationPinWrapper: {
    position: 'absolute',
    top: 31,
    left: 51,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationPinImage: {
    width: 44,
    height: 44,
  },
  footerContainer: {
    position: 'absolute',
    bottom: Math.max(SCREEN_HEIGHT * 0.12, 60),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  progressTrack: {
    width: 140,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#201938',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#D4AF37', // Metallic gold route fill
    borderRadius: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D4AF37',
  },
});
