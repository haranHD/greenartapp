import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { loadAsync } from 'expo-font';
import Feather from '@expo/vector-icons/Feather';
import { FONT_ASSETS } from '../theme/typography';
import { Premium } from '../theme/premium';

/** Mount the application only after bundled text and icon faces are ready, avoiding font swaps. */
export function AppFontLoader({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    loadAsync({ ...FONT_ASSETS, ...Feather.font }).then(async () => {
      // Expo's web observer probes Latin text. Noto Sans Tamil needs a Tamil sample
      // to force glyph loading before the first Tamil locality is rendered.
      if (Platform.OS === 'web' && typeof document !== 'undefined' && document.fonts) {
        await Promise.all([
          ...Object.keys(FONT_ASSETS).map(name => document.fonts.load(`14px ${name}`,
            name.startsWith('NotoSansTamil_') ? 'தமிழ்' : 'BESbswy0123456789')),
          ...Object.keys(Feather.font).map(name => document.fonts.load(`14px ${name}`, typeof Feather.glyphMap.home === 'number' ? String.fromCharCode(Feather.glyphMap.home) : Feather.glyphMap.home)),
        ]);
      }
      if (active) setReady(true);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt]);
  if (ready) return <>{children}</>;
  return <View style={{ flex: 1, minHeight: '100%', backgroundColor: Premium.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
    {failed ? <>
      <Text accessibilityRole="alert" style={{ color: Premium.text, fontSize: 14, textAlign: 'center' }}>Unable to load the app fonts.</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.reload();
        else setAttempt(v => v + 1);
      }} style={{ padding: 16 }}><Text style={{ color: Premium.violet }}>Retry</Text></TouchableOpacity>
    </> : <ActivityIndicator accessibilityLabel="Loading application fonts" color={Premium.violet} />}
  </View>;
}
