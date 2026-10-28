import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { formatLakhs } from '../utils/formatters';
import { MobileTab, EstimateStep, ValuationHistoryItem } from '../types';

export interface HistoryScreenProps {
  bottomInset: number;
  valuationHistory: ValuationHistoryItem[];
  setValuationHistory: React.Dispatch<React.SetStateAction<ValuationHistoryItem[]>>;
  setTargetLat: (lat: number) => void;
  setTargetLng: (lng: number) => void;
  setActiveLocality: (loc: string) => void;
  setLandUsage: (usage: number) => void;
  executeCalculation: (lat: number, lng: number, usage: number) => void;
  setActiveTab: (tab: MobileTab) => void;
  setEstimateStep: (step: EstimateStep) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  bottomInset,
  valuationHistory,
  setValuationHistory,
  setTargetLat,
  setTargetLng,
  setActiveLocality,
  setLandUsage,
  executeCalculation,
  setActiveTab,
  setEstimateStep,
}) => {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.scrollBody, { paddingBottom: 110 + bottomInset }]}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={true}
    >
      <View style={styles.screenHeaderBox}>
        <Text style={styles.viewTitle}>Valuation History</Text>
        <Text style={styles.viewSubtitle}>
          Evidence-based valuations computed during your session.
        </Text>
      </View>

      {valuationHistory.length > 0 ? (
        <View style={{ gap: 10 }}>
          <View style={styles.historyMetaBar}>
            <Text style={styles.historyCountText}>{valuationHistory.length} Saved Records</Text>
            <TouchableOpacity onPress={() => setValuationHistory([])}>
              <Text style={styles.historyClearBtn}>Clear History</Text>
            </TouchableOpacity>
          </View>

          {valuationHistory.map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <View style={styles.historyCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyLocalityName}>{item.locality}</Text>
                  <Text style={styles.historyMetaSub}>
                    {item.district} • {item.landUsageLabel} • {item.calculatedAt}
                  </Text>
                </View>
                <View style={styles.historyConfidenceBadge}>
                  <Text style={styles.historyConfidenceText}>{item.confidence}</Text>
                </View>
              </View>

              <View style={styles.historyRateRow}>
                <View>
                  <Text style={styles.historyRateCent}>
                    {formatLakhs(item.ratePerCent)} / Cent
                  </Text>
                  <Text style={styles.historyRateSqFt}>
                    ₹{Math.round(item.ratePerSqFt).toLocaleString('en-IN')} / Sq.Ft
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.historyViewBtn}
                  onPress={() => {
                    setTargetLat(item.targetLat);
                    setTargetLng(item.targetLng);
                    setActiveLocality(item.locality);
                    setLandUsage(item.landUsage);
                    executeCalculation(item.targetLat, item.targetLng, item.landUsage);
                  }}
                >
                  <Text style={styles.historyViewBtnText}>View Estimate →</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: '#D4AF37',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ width: 1.5, height: 6, backgroundColor: '#D4AF37', marginBottom: -2 }} />
              <View style={{ width: 5, height: 1.5, backgroundColor: '#D4AF37', alignSelf: 'center', marginLeft: 4 }} />
            </View>
          </View>

          <Text style={styles.emptyCardTitle}>No Valuation History Yet</Text>
          <Text style={styles.emptyCardSub}>
            Property valuations you calculate will be saved here during your session for comparative analysis and reference.
          </Text>

          <TouchableOpacity
            style={[styles.primaryActionBtn, { marginTop: 16 }]}
            onPress={() => {
              setActiveTab('estimate');
              setEstimateStep('selection');
            }}
          >
            <Text style={styles.primaryActionBtnText}>Start a Land Valuation</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollBody: {
    padding: 16,
    gap: 16,
  },
  screenHeaderBox: {
    marginBottom: 4,
  },
  viewTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  viewSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 18,
  },
  historyMetaBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  historyCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  historyClearBtn: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  historyCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  historyLocalityName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  historyMetaSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  historyConfidenceBadge: {
    backgroundColor: '#FEFCE8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  historyConfidenceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  historyRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FAF5FF',
  },
  historyRateCent: {
    fontSize: 16,
    fontWeight: '900',
    color: '#240046',
  },
  historyRateSqFt: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  historyViewBtn: {
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  historyViewBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#240046',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FAF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptyCardSub: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  primaryActionBtn: {
    backgroundColor: '#240046',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4AF37',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

