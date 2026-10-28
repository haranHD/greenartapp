import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { MobileTab, NearbyLandRecordDto } from '../types';

export interface NearbyRecordsSubScreenProps {
  bottomInset: number;
  previousTab: MobileTab;
  setActiveTab: (tab: MobileTab) => void;
  activeLocality: string;
  targetLat: number;
  targetLng: number;
  displayedNearbyRecords: NearbyLandRecordDto[];
  recordsRadiusScope: 'within1km' | 'all';
  setRecordsRadiusScope: (scope: 'within1km' | 'all') => void;
  nearbyRecords: NearbyLandRecordDto[];
  nearbyWithin1kmCount: number;
  filterRecordSource: string;
  setFilterRecordSource: (source: string) => void;
  loadingNearby: boolean;
  nearbyError: string | null;
  fetchNearbyRecords: (lat: number, lng: number, scope: 'within1km' | 'all') => void;
}

export const NearbyRecordsSubScreen: React.FC<NearbyRecordsSubScreenProps> = ({
  bottomInset,
  previousTab,
  setActiveTab,
  activeLocality,
  targetLat,
  targetLng,
  displayedNearbyRecords,
  recordsRadiusScope,
  setRecordsRadiusScope,
  nearbyRecords,
  nearbyWithin1kmCount,
  filterRecordSource,
  setFilterRecordSource,
  loadingNearby,
  nearbyError,
  fetchNearbyRecords,
}) => {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.scrollBody, { paddingBottom: 110 + bottomInset }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled={true}
    >
      {/* Back Nav Bar */}
      <TouchableOpacity
        style={styles.subBackBtn}
        onPress={() => setActiveTab(previousTab)}
      >
        <Text style={styles.subBackBtnText}>
          ← Back to {previousTab === 'home' ? 'Home' : 'Valuation'}
        </Text>
      </TouchableOpacity>

      {/* Header & Scope Filter */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardTitle}>Nearby Records</Text>
            <Text style={styles.cardSubtitle}>
              Proximity to {activeLocality} ({targetLat.toFixed(4)}, {targetLng.toFixed(4)})
            </Text>
          </View>
          <Text style={styles.badgeSubtle}>{displayedNearbyRecords.length} Found</Text>
        </View>

        {/* Radius Scope Tabs */}
        <View style={styles.scopeTabsRow}>
          <TouchableOpacity
            style={[
              styles.scopeTabBtn,
              recordsRadiusScope === 'within1km' && styles.scopeTabBtnActive,
            ]}
            onPress={() => setRecordsRadiusScope('within1km')}
          >
            <Text
              style={[
                styles.scopeTabText,
                recordsRadiusScope === 'within1km' && styles.scopeTabTextActive,
              ]}
            >
              Within 1 km ({recordsRadiusScope === 'within1km' ? nearbyRecords.length : nearbyWithin1kmCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.scopeTabBtn,
              recordsRadiusScope === 'all' && styles.scopeTabBtnActive,
            ]}
            onPress={() => setRecordsRadiusScope('all')}
          >
            <Text
              style={[
                styles.scopeTabText,
                recordsRadiusScope === 'all' && styles.scopeTabTextActive,
              ]}
            >
              Corridor 5 km ({recordsRadiusScope === 'all' ? nearbyRecords.length : '5 km'})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Source Category Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, marginTop: 8 }}
        >
          {[
            { id: 'All', label: 'All' },
            { id: 'VerifiedTransaction', label: 'Verified Deeds' },
            { id: 'AdvertisedAskingPrice', label: 'Asking Prices' },
            { id: 'GovernmentGuideline', label: 'Guideline' },
            { id: 'ClientResearch', label: 'Field Research' },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.filterChip,
                filterRecordSource === item.id && styles.filterChipActive,
              ]}
              onPress={() => setFilterRecordSource(item.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterRecordSource === item.id && styles.filterChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Records List with PostGIS Authoritative Distance */}
      {loadingNearby ? (
        <ActivityIndicator color="#240046" style={{ marginVertical: 20 }} />
      ) : nearbyError ? (
        <View style={styles.emptyCard}>
          <Text style={[styles.emptyCardTitle, { color: '#991B1B' }]}>Proximity Query Failed</Text>
          <Text style={styles.emptyCardSub}>{nearbyError}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { marginTop: 12 }]}
            onPress={() => fetchNearbyRecords(targetLat, targetLng, recordsRadiusScope)}
          >
            <Text style={styles.retryBtnText}>Retry Proximity Query</Text>
          </TouchableOpacity>
        </View>
      ) : displayedNearbyRecords.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyCardTitle}>No Records Found</Text>
          <Text style={styles.emptyCardSub}>
            No land records match the selected {recordsRadiusScope === 'within1km' ? '1,000-metre radius' : '5 km corridor'} or source filter.
          </Text>
        </View>
      ) : (
        displayedNearbyRecords.map((rec) => {
          const isWithin1km = rec.distanceMeters <= 1000;
          return (
            <View
              key={rec.id}
              style={[styles.recordCard, isWithin1km && styles.recordCardNear]}
            >
              <View style={styles.recordCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recordLocalityTitle}>{rec.locality}</Text>
                  <Text style={styles.recordSubMeta}>
                    {rec.district} {rec.taluk ? `• ${rec.taluk}` : ''}{' '}
                    {rec.surveyNumber ? `• SF ${rec.surveyNumber}` : ''}
                  </Text>
                </View>
                <View style={[styles.distPill, isWithin1km ? styles.distPillGreen : styles.distPillGray]}>
                  <Text style={[styles.distPillText, isWithin1km ? styles.distPillTextGreen : styles.distPillTextGray]}>
                    {rec.distanceMeters < 1000
                      ? `${Math.round(rec.distanceMeters)}m away`
                      : `${(rec.distanceMeters / 1000).toFixed(1)}km away`}
                  </Text>
                </View>
              </View>

              <View style={styles.recordRateRow}>
                <View>
                  <Text style={styles.recordCentRate}>
                    ₹{(rec.normalizedRatePerCent / 100000).toFixed(2)} Lakhs / Cent
                  </Text>
                  <Text style={styles.recordSqFtRate}>
                    ₹{rec.normalizedRatePerSqFt.toLocaleString('en-IN')} / Sq.Ft
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.recordTotalPrice}>
                    ₹{rec.originalPrice.toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.recordArea}>
                    {rec.originalArea} {rec.originalUnit}
                  </Text>
                </View>
              </View>

              <View style={styles.recordBadgeRow}>
                <View
                  style={[
                    styles.sourceTag,
                    rec.sourceCategory === 'VerifiedTransaction' && rec.verificationStatus === 'Verified'
                      ? styles.sourceTagGreen
                      : rec.sourceCategory === 'GovernmentGuideline'
                        ? styles.sourceTagBlue
                        : styles.sourceTagAmber,
                  ]}
                >
                  <Text
                    style={[
                      styles.sourceTagText,
                      rec.sourceCategory === 'VerifiedTransaction' && rec.verificationStatus === 'Verified'
                        ? styles.sourceTagTextGreen
                        : rec.sourceCategory === 'GovernmentGuideline'
                          ? styles.sourceTagTextBlue
                          : styles.sourceTagTextAmber,
                    ]}
                  >
                    {rec.sourceCategory === 'GovernmentGuideline'
                      ? 'Guideline'
                      : rec.sourceCategory === 'VerifiedTransaction'
                        ? (rec.verificationStatus === 'Verified' ? 'Verified Deed' : 'Deed (Unverified)')
                        : rec.sourceCategory === 'ClientResearch'
                          ? 'Field Research'
                          : 'Asking Price'}
                  </Text>
                </View>

                <View style={styles.usageTag}>
                  <Text style={styles.usageTagText}>{rec.landUsage}</Text>
                </View>

                <Text style={styles.recordDateText}>
                  {rec.observationDate ? rec.observationDate.split('T')[0] : '—'}
                </Text>
              </View>
            </View>
          );
        })
      )}
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  badgeSubtle: {
    fontSize: 11,
    color: '#240046',
    fontWeight: '700',
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  scopeTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FAF5FF',
    borderRadius: 10,
    padding: 3,
    gap: 4,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  scopeTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  scopeTabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  scopeTabText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  scopeTabTextActive: {
    color: '#240046',
  },
  filterChip: {
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  filterChipActive: {
    backgroundColor: '#240046',
    borderColor: '#D4AF37',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recordCardNear: {
    borderColor: '#D4AF37',
    backgroundColor: '#FAF5FF',
  },
  recordCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  recordLocalityTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  recordSubMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  distPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  distPillGreen: {
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  distPillGray: {
    backgroundColor: '#F1F5F9',
  },
  distPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  distPillTextGreen: {
    color: '#B45309',
  },
  distPillTextGray: {
    color: '#64748B',
  },
  recordRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#FAF5FF',
  },
  recordCentRate: {
    fontSize: 14,
    fontWeight: '900',
    color: '#240046',
  },
  recordSqFtRate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  recordTotalPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  recordArea: {
    fontSize: 11,
    color: '#64748B',
  },
  recordBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  sourceTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sourceTagGreen: {
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  sourceTagBlue: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  sourceTagAmber: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  sourceTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sourceTagTextGreen: {
    color: '#B45309',
  },
  sourceTagTextBlue: {
    color: '#240046',
  },
  sourceTagTextAmber: {
    color: '#B45309',
  },
  usageTag: {
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  usageTagText: {
    fontSize: 10,
    color: '#475569',
  },
  recordDateText: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginLeft: 'auto',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  emptyCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptyCardSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  retryBtn: {
    backgroundColor: '#240046',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

