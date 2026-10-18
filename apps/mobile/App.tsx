import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, StatusBar, TouchableOpacity } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1b5e20" />
      <View style={styles.header}>
        <Text style={styles.brandTitle}>GREENART PROPERTIES</Text>
        <Text style={styles.brandSubtitle}>Land Market Rate Analyst</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Find Indicative Land Value</Text>
          <Text style={styles.cardDescription}>
            Explore land market trends across Coimbatore pilot localities. Select a target location on the map to view evidence-backed price ranges.
          </Text>

          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              Independent Search: Your current physical GPS location is never assumed to be the property location.
            </Text>
          </View>

          <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
            <Text style={styles.actionButtonText}>Open Interactive Map</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionHeader}>Supported Pilot Areas</Text>
          <View style={styles.localityRow}>
            <Text style={styles.localityTag}>Kannampalayam</Text>
            <Text style={styles.localityTag}>Sulur Corridor</Text>
            <Text style={styles.localityTag}>Saravanampatti</Text>
            <Text style={styles.localityTag}>Pollachi</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#1b5e20',
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  brandSubtitle: {
    color: '#e2e8f0',
    fontSize: 13,
    marginTop: 4,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  noticeBox: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  noticeText: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 16,
  },
  actionButton: {
    backgroundColor: '#1b5e20',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  infoSection: {
    marginTop: 8,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  localityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  localityTag: {
    backgroundColor: '#e2e8f0',
    color: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    fontSize: 13,
    fontWeight: '500',
  },
});

