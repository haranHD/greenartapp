import { AppText as Text } from './AppText';
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

export function LocalitySearchError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.notice} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry location search" onPress={onRetry} style={styles.retry}>
        <Text style={styles.retryText}>Try search again</Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  notice: { padding: 14, backgroundColor: '#FFFBEB', borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  message: { fontSize: 13, lineHeight: 20, color: '#92400E' },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
});
