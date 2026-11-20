import { AppText as Text } from './AppText';
import React from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Premium } from '../theme/premium';
export interface AppHeaderProps { isHealthy: boolean; healthStatus?: string; onPressProfile?: () => void; user?: { fullName?: string; email?: string } | null; }
export const AppHeader: React.FC<AppHeaderProps> = ({ isHealthy, healthStatus, onPressProfile }) => {
  const { width, fontScale } = useWindowDimensions();
  const compact = width / fontScale < 380;
  const status = isHealthy ? 'Service online' : healthStatus === 'Degraded' ? 'Limited service' : healthStatus ? 'Service unavailable' : 'Connecting';
  return <View style={[styles.header, compact && { paddingHorizontal: 14 }]}><View style={styles.inner}>
    <Text style={styles.title}>Property insights</Text>
    <View style={styles.controls}>
      <View accessibilityLabel={status} style={styles.status}><View style={[styles.dot, { backgroundColor: isHealthy ? '#34805A' : '#94733A' }]} />{!compact && <Text style={styles.statusText}>{status}</Text>}</View>
      {onPressProfile && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open your profile" onPress={onPressProfile} accessibilityHint="View your account and settings" style={styles.account}><Feather accessible={false} name="user" size={21} color={Premium.violet} /></TouchableOpacity>}
    </View>
  </View></View>;
};
const styles = StyleSheet.create({
  header: { backgroundColor: '#FFFFFF', minHeight: 64, borderBottomWidth: 1, borderBottomColor: Premium.border, paddingHorizontal: 20, paddingVertical: 10, justifyContent: 'center' },
  inner: { width: '100%', maxWidth: 1080, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 17, lineHeight: 24, fontWeight: '600', letterSpacing: -.4, color: Premium.text, flexShrink: 1 },
  controls: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, color: Premium.secondary },
  account: { width: 44, height: 44, backgroundColor: Premium.lavender, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
