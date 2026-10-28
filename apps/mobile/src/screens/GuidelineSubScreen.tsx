import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { MobileTab, LocalityReference } from '../types';

export interface GuidelineSubScreenProps {
  bottomInset: number;
  previousTab: MobileTab;
  setActiveTab: (tab: MobileTab) => void;
  localities: LocalityReference[];
  loadingLocalities: boolean;
}

export const GuidelineSubScreen: React.FC<GuidelineSubScreenProps> = ({
  bottomInset,
  previousTab,
  setActiveTab,
  localities,
  loadingLocalities,
}) => {
  return (
    <ScrollView
      contentContainerStyle={[styles.scrollBody, { paddingBottom: 110 + bottomInset }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Back Nav Bar */}
      <TouchableOpacity
        style={styles.subBackBtn}
        onPress={() => setActiveTab(previousTab)}
      >
        <Text style={styles.subBackBtnText}>
          ← Back to {previousTab === 'home' ? 'Home' : 'Profile'}
        </Text>
      </TouchableOpacity>

      {/* Statutory Guideline Overview */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Statutory Guideline Rates</Text>
        <Text style={styles.cardSubtitle}>
          Official minimum valuation benchmarks from the Tamil Nadu Registration Department (TNREGINET) for stamp duty calculation.
        </Text>

        {loadingLocalities ? (
          <ActivityIndicator color="#240046" style={{ marginVertical: 14 }} />
        ) : (
          <View style={{ gap: 8, marginTop: 10 }}>
            {localities.map((loc) => (
              <View key={loc.name} style={styles.guidelineHubCard}>
                <View style={styles.guidelineHubTop}>
                  <View>
                    <Text style={styles.guidelineHubName}>{loc.name}</Text>
                    <Text style={styles.guidelineHubDistrict}>{loc.district}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.guidelineHubRate}>
                      ₹{(loc.guidelineRatePerCent / 100000).toFixed(2)} Lakhs
                    </Text>
                    <Text style={styles.guidelineHubUnit}>Per Cent</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* How the Valuation Engine Works */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionHeaderTitle}>How the Valuation Engine Works</Text>
        <Text style={styles.sectionHeaderDesc}>
          Objective statistical principles governing evidence-based property rate calculations:
        </Text>

        <View style={styles.workflowStepItem}>
          <View style={styles.stepNumberBadge}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>1,000m Geodesic Search</Text>
            <Text style={styles.stepDesc}>
              Evaluates comparable market transactions strictly within a 1 km radius of the target coordinates using PostGIS geography calculation.
            </Text>
          </View>
        </View>

        <View style={styles.workflowStepItem}>
          <View style={styles.stepNumberBadge}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>Outlier-Filtered Median</Text>
            <Text style={styles.stepDesc}>
              Calculates statistical median and 25th–75th percentile IQR bands, rejecting extreme speculative asking prices.
            </Text>
          </View>
        </View>

        <View style={styles.workflowStepItem}>
          <View style={styles.stepNumberBadge}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>Statutory Benchmark Separation</Text>
            <Text style={styles.stepDesc}>
              Government guideline rates from TNREGINET are maintained strictly as reference benchmarks and never blended into open-market transactions.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollBody: {
    padding: 16,
    gap: 16,
  },
  subBackBtn: {
    paddingVertical: 8,
  },
  subBackBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#240046',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  guidelineHubCard: {
    backgroundColor: '#FAF5FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  guidelineHubTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  guidelineHubName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  guidelineHubDistrict: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  guidelineHubRate: {
    fontSize: 14,
    fontWeight: '800',
    color: '#240046',
  },
  guidelineHubUnit: {
    fontSize: 10,
    color: '#64748B',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionHeaderDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },
  workflowStepItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEFCE8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  stepDesc: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
    marginTop: 2,
  },
});

