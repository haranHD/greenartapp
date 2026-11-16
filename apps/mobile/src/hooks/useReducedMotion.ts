import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useReducedMotion() {
  const [preference, setPreference] = useState(() => ({
    ready: Platform.OS === 'web',
    reduced: Platform.OS !== 'web' || typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }));
  useEffect(() => {
    if (Platform.OS === 'web') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setPreference({ ready: true, reduced: media.matches });
      update(); media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    let current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(reduced => { if (current) setPreference({ ready: true, reduced }); }).catch(() => { if (current) setPreference({ ready: true, reduced: true }); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', reduced => setPreference({ ready: true, reduced }));
    return () => { current = false; listener.remove(); };
  }, []);
  return preference;
}
