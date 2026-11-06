import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Colors } from '../theme/colors';
import { LAND_USAGES, formatLakhs } from '../utils/formatters';
import {
  MobileTab,
  EstimateStep,
  EstimateApiResponse,
  EstimateSuccessResponse,
  EstimateInsufficientDataResponse,
} from '../types';

export interface ValuationScreenProps {
  bottomInset: number;
  estimateStep: EstimateStep;
  setEstimateStep: (step: EstimateStep) => void;
  activeLocality: string;
  targetLat: number;
  targetLng: number;
  landUsage: number;
  setLandUsage: (id: number) => void;
  displayUnit: 'Cent' | 'SqFt';
  setDisplayUnit: (u: 'Cent' | 'SqFt') => void;
  showAdvancedCoords: boolean;
  setShowAdvancedCoords: (s: boolean) => void;
  latInput: string;
  setLatInput: (s: string) => void;
  lngInput: string;
  setLngInput: (s: string) => void;
  handleManualCoordSubmit: () => void;
  executeCalculation: (lat: number, lng: number, usage: number) => void;
  loadingEstimate: boolean;
  estimateError: string | null;
  estimate: EstimateApiResponse | null;
  currentUsageObj: { id: number; label: string };
  handleGenerateValuationPdf: (estimate: EstimateSuccessResponse) => void;
  setActiveTab: (tab: MobileTab) => void;
  setPreviousTab: (tab: MobileTab) => void;
}

export const ValuationScreen: React.FC<ValuationScreenProps> = ({
  bottomInset,
  estimateStep,
  setEstimateStep,
  activeLocality,
  targetLat,
  targetLng,
  landUsage,
  setLandUsage,
  displayUnit,
  setDisplayUnit,
  showAdvancedCoords,
  setShowAdvancedCoords,
  latInput,
  setLatInput,
  lngInput,
  setLngInput,
  handleManualCoordSubmit,
  executeCalculation,
  loadingEstimate,
  estimateError,
  estimate,
  currentUsageObj,
  handleGenerateValuationPdf,
  setActiveTab,
  setPreviousTab,
}) => {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.scrollBody, { paddingBottom: 110 + bottomInset }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled={true}
    >
      {/* Step Segment Control */}
      <View style={styles.stepTabsRow}>
        <TouchableOpacity
          style={[styles.stepTabBtn, estimateStep === 'selection' && styles.stepTabBtnActive]}
          onPress={() => setEstimateStep('selection')}
        >
          <Text
            style={[
              styles.stepTabText,
              estimateStep === 'selection' && styles.stepTabTextActive,
            ]}
          >
            1. Location & Zoning
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.stepTabBtn, estimateStep === 'result' && styles.stepTabBtnActive]}
          onPress={() => {
            if (estimate) setEstimateStep('result');
            else executeCalculation(targetLat, targetLng, landUsage);
          }}
        >
          <Text
            style={[
              styles.stepTabText,
              estimateStep === 'result' && styles.stepTabTextActive,
            ]}
          >
            2. Valuation Result
          </Text>
        </TouchableOpacity>
      </View>

      {/* STEP 1: SELECTION */}
      {estimateStep === 'selection' && (
        <View style={styles.card}>
          {/* Target Location Header */}
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardSectionLabel}>TARGET LOCATION</Text>
              <Text style={styles.cardTitle}>{activeLocality}</Text>
              <Text style={styles.cardSubtitle}>
                {targetLat.toFixed(4)}° N, {targetLng.toFixed(4)}° E • Coimbatore
              </Text>
            </View>
            <TouchableOpacity
              style={styles.changeLocBtn}
              onPress={() => setActiveTab('search')}
              activeOpacity={0.8}
            >
              <Text style={styles.changeLocBtnText}>Change on Map 📍</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardDivider} />

          {/* Zoning Classification */}
          <Text style={styles.cardSectionLabel}>LAND ZONING</Text>
          <Text style={styles.cardSubtitle}>Select classification to match valuation rules:</Text>

          <View style={styles.usageGrid}>
            {LAND_USAGES.map((u) => {
              const isSelected = landUsage === u.id;
              return (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.usageChipBtn, isSelected && styles.usageChipBtnActive]}
                  onPress={() => setLandUsage(u.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.usageChipBtnText,
                      isSelected && styles.usageChipBtnTextActive,
                    ]}
                  >
                    {u.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.cardDivider} />

          {/* Unit Toggle */}
          <View style={styles.unitToggleRow}>
            <Text style={styles.unitToggleLabel}>Display Benchmark In:</Text>
            <View style={styles.unitPillBox}>
              <TouchableOpacity
                style={[styles.unitPill, displayUnit === 'Cent' && styles.unitPillActive]}
                onPress={() => setDisplayUnit('Cent')}
              >
                <Text
                  style={[
                    styles.unitPillText,
                    displayUnit === 'Cent' && styles.unitPillTextActive,
                  ]}
                >
                  Per Cent
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitPill, displayUnit === 'SqFt' && styles.unitPillActive]}
                onPress={() => setDisplayUnit('SqFt')}
              >
                <Text
                  style={[
                    styles.unitPillText,
                    displayUnit === 'SqFt' && styles.unitPillTextActive,
                  ]}
                >
                  Per Sq.Ft
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Collapsible Advanced Coordinates Drawer */}
          <TouchableOpacity
            style={styles.advancedDrawerToggle}
            onPress={() => setShowAdvancedCoords(!showAdvancedCoords)}
          >
            <Text style={styles.advancedDrawerText}>
              {showAdvancedCoords ? '▲ Hide Coordinate Inputs' : '▼ Manual Coordinate Override'}
            </Text>
          </TouchableOpacity>

          {showAdvancedCoords && (
            <View style={styles.advancedDrawerContent}>
              <View style={styles.coordInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputMiniLabel}>Latitude</Text>
                  <TextInput
                    style={styles.coordTextInput}
                    value={latInput}
                    onChangeText={setLatInput}
                    keyboardType="numeric"
                    placeholder="11.0012"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputMiniLabel}>Longitude</Text>
                  <TextInput
                    style={styles.coordTextInput}
                    value={lngInput}
                    onChangeText={setLngInput}
                    keyboardType="numeric"
                    placeholder="77.0874"
                  />
                </View>
              </View>
              <TouchableOpacity
                style={styles.applyCoordBtn}
                onPress={handleManualCoordSubmit}
              >
                <Text style={styles.applyCoordBtnText}>Apply Coordinates</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Primary Calculate Valuation CTA */}
          <TouchableOpacity
            style={[styles.primaryActionBtn, { marginTop: 16 }]}
            onPress={() => executeCalculation(targetLat, targetLng, landUsage)}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryActionBtnText}>Calculate Land Valuation →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 2: VALUATION RESULTS */}
      {estimateStep === 'result' && (
        <>
          {loadingEstimate ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingCardTitle}>Analyzing 1,000m Corridors...</Text>
              <Text style={styles.loadingCardSub}>
                Filtering verified transactions, rejecting speculative outliers, and computing median benchmarks.
              </Text>
            </View>
          ) : estimateError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorCardTitle}>Valuation Calculation Notice</Text>
              <Text style={styles.errorCardSub}>{estimateError}</Text>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => executeCalculation(targetLat, targetLng, landUsage)}
              >
                <Text style={styles.primaryActionBtnText}>Retry Calculation</Text>
              </TouchableOpacity>
            </View>
          ) : estimate && estimate.status === 'Success' ? (
            (() => {
              const estSuccess = estimate as EstimateSuccessResponse;
              const medianCent = estSuccess.priceRangePerCent.medianRate;
              const medianSqFt = estSuccess.priceRangePerSqFt.medianRate;
              const iqrCent25 = estSuccess.priceRangePerCent.percentile25;
              const iqrCent75 = estSuccess.priceRangePerCent.percentile75;
              const iqrSqFt25 = estSuccess.priceRangePerSqFt.percentile25;
              const iqrSqFt75 = estSuccess.priceRangePerSqFt.percentile75;
              const minCent = estSuccess.priceRangePerCent.minRate;
              const maxCent = estSuccess.priceRangePerCent.maxRate;
              const minSqFt = estSuccess.priceRangePerSqFt.minRate;
              const maxSqFt = estSuccess.priceRangePerSqFt.maxRate;
              const guideline = estSuccess.governmentGuidelineReference;

              return (
                <>
                  {/* Indicative Market Valuation Card */}
                  <View style={styles.valuationHeroCard}>
                    <View style={styles.valHeaderRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.valTag}>Indicative Market Rate</Text>
                        <Text style={styles.valLocalityTitle}>
                          {activeLocality} • {currentUsageObj.label}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.confidencePill,
                          estSuccess.confidence === 'High'
                            ? styles.confidencePillHigh
                            : styles.confidencePillModerate,
                        ]}
                      >
                        <Text style={styles.confidencePillText}>
                          {estSuccess.comparableRecordCount > 0
                            ? `${estSuccess.confidence === 'High' ? 'High' : 'Moderate'} Confidence (${estSuccess.comparableRecordCount} Records)`
                            : 'Market Estimate'}
                        </Text>
                      </View>
                    </View>

                    {/* Rate Display */}
                    <View style={styles.bigRateDisplay}>
                      <Text style={styles.bigRateNumber}>
                        {displayUnit === 'Cent'
                          ? formatLakhs(medianCent)
                          : `₹${Math.round(medianSqFt).toLocaleString('en-IN')}`}
                      </Text>
                      <Text style={styles.bigRateUnit}>
                        {displayUnit === 'Cent' ? '/ Cent' : '/ Sq.Ft'}
                      </Text>
                    </View>

                    <Text style={styles.convertedRateSub}>
                      {displayUnit === 'Cent'
                        ? `Equivalent to ₹${Math.round(medianSqFt).toLocaleString('en-IN')} / Sq.Ft`
                        : `Equivalent to ${formatLakhs(medianCent)} / Cent`}
                    </Text>

                    {/* Range Metrics */}
                    <View style={styles.rangesGrid}>
                      <View style={styles.rangeBox}>
                        <Text style={styles.rangeBoxLabel}>Typical Range (25th–75th)</Text>
                        <Text style={styles.rangeBoxVal}>
                          {displayUnit === 'Cent'
                            ? `${formatLakhs(iqrCent25)} – ${formatLakhs(iqrCent75)}`
                            : `₹${Math.round(iqrSqFt25).toLocaleString('en-IN')} – ₹${Math.round(iqrSqFt75).toLocaleString('en-IN')}`}
                        </Text>
                      </View>
                      <View style={styles.rangeBox}>
                        <Text style={styles.rangeBoxLabel}>Observed Range (Min–Max)</Text>
                        <Text style={styles.rangeBoxVal}>
                          {displayUnit === 'Cent'
                            ? `${formatLakhs(minCent)} – ${formatLakhs(maxCent)}`
                            : `₹${Math.round(minSqFt).toLocaleString('en-IN')} – ₹${Math.round(maxSqFt).toLocaleString('en-IN')}`}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.estimateDisclaimer}>
                      Indicative statistical estimate derived strictly from recent 1,000m comparables; not an official legal appraisal or guaranteed sale price.
                    </Text>
                  </View>

                  {/* Statutory Guideline Rate Benchmark */}
                  {guideline && (
                    <View style={styles.guidelineCard}>
                      <View style={styles.guidelineTopRow}>
                        <View>
                          <Text style={styles.guidelineTag}>Statutory Guideline Value</Text>
                          <Text style={styles.guidelineSubTitle}>TNREGINET Official Benchmark</Text>
                        </View>
                        <Text style={styles.guidelineRateVal}>
                          {formatLakhs(guideline.guidelineRatePerCent)} / Cent
                        </Text>
                      </View>
                      <Text style={styles.guidelineNotice}>
                        {guideline.legalNotice ||
                          'Government statutory minimum used for stamp duty registration. Kept strictly separate from open-market valuations.'}
                      </Text>
                    </View>
                  )}

                  {/* Action Links */}
                  <View style={{ gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      style={styles.exportPdfBtn}
                      onPress={() => handleGenerateValuationPdf(estSuccess)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.exportPdfBtnText}>
                        📄 Export Official Valuation PDF Report
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.primaryActionBtn}
                      onPress={() => {
                        setPreviousTab('estimate');
                        setActiveTab('records');
                      }}
                    >
                      <Text style={styles.primaryActionBtnText}>
                        View 1 km Comparables ({estSuccess.comparableRecordCount})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondaryActionBtn}
                      onPress={() => setEstimateStep('selection')}
                    >
                      <Text style={styles.secondaryActionBtnText}>
                        Change Location or Zoning
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.secondaryActionBtn, { borderColor: Colors.primary }]}
                      onPress={() => setActiveTab('search')}
                    >
                      <Text style={[styles.secondaryActionBtnText, { color: Colors.primary }]}>
                        Adjust Pin on Interactive Map
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()
          ) : estimate && estimate.status === 'InsufficientData' ? (
            (() => {
              const insuff = estimate as EstimateInsufficientDataResponse;
              const guideline = insuff.governmentGuidelineReference;
              return (
                <>
                  {/* Card #1: Statutory Guideline Benchmark Price Card (TOP) */}
                  {guideline ? (
                    <View style={styles.valuationHeroCard}>
                      <View style={styles.valHeaderRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.valTag}>Statutory Guideline Price</Text>
                          <Text style={styles.valLocalityTitle}>
                            {guideline.locality || activeLocality} • {currentUsageObj.label}
                          </Text>
                        </View>
                        <View style={[styles.confidencePill, styles.confidencePillHigh]}>
                          <Text style={styles.confidencePillText}>TNREGINET Official</Text>
                        </View>
                      </View>

                      {/* Big Prominent Price Display */}
                      <View style={styles.bigRateDisplay}>
                        <Text style={styles.bigRateNumber}>
                          {displayUnit === 'Cent'
                            ? formatLakhs(guideline.guidelineRatePerCent)
                            : `₹${Number(guideline.guidelineRatePerSqFt).toLocaleString('en-IN')}`}
                        </Text>
                        <Text style={styles.bigRateUnit}>
                          {displayUnit === 'Cent' ? '/ Cent' : '/ Sq.Ft'}
                        </Text>
                      </View>

                      <Text style={styles.convertedRateSub}>
                        {displayUnit === 'Cent'
                          ? `Equivalent to ₹${Number(guideline.guidelineRatePerSqFt).toLocaleString('en-IN')} / Sq.Ft`
                          : `Equivalent to ${formatLakhs(guideline.guidelineRatePerCent)} / Cent`}
                      </Text>

                      {/* Quick Unit Switcher */}
                      <View style={styles.unitToggleRow}>
                        <Text style={styles.unitToggleLabel}>Display Unit Rate:</Text>
                        <View style={styles.unitPillBox}>
                          <TouchableOpacity
                            style={[styles.unitPill, displayUnit === 'Cent' && styles.unitPillActive]}
                            onPress={() => setDisplayUnit('Cent')}
                          >
                            <Text
                              style={[
                                styles.unitPillText,
                                displayUnit === 'Cent' && styles.unitPillTextActive,
                              ]}
                            >
                              Per Cent
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.unitPill, displayUnit === 'SqFt' && styles.unitPillActive]}
                            onPress={() => setDisplayUnit('SqFt')}
                          >
                            <Text
                              style={[
                                styles.unitPillText,
                                displayUnit === 'SqFt' && styles.unitPillTextActive,
                              ]}
                            >
                              Per Sq.Ft
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={styles.estimateDisclaimer}>
                        {guideline.legalNotice ||
                          'Official statutory guideline benchmark from the Tamil Nadu Registration Department (TNREGINET via LandLens) for stamp duty calculation. Kept strictly segregated from open-market valuations.'}
                      </Text>
                    </View>
                  ) : null}

                  {/* Evidence Notice (Compact & Clean) */}
                  <View style={[styles.insufficientDataCard, guideline ? { marginTop: 12 } : null]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Text style={{ fontSize: 13 }}>ℹ️</Text>
                      <Text style={styles.insufficientTitle}>Limited 1,000m Comparables</Text>
                    </View>
                    <Text style={styles.insufficientSub}>
                      {insuff.message ||
                        `Found ${insuff.comparableRecordsFound} verified transaction(s) within 1,000m for ${currentUsageObj.label}. A minimum of ${insuff.minimumRequiredRecords} is required for statistical open-market medians.`}
                    </Text>
                  </View>

                  {/* Action Buttons */}
                  <View style={{ gap: 8, marginTop: 14 }}>
                    <TouchableOpacity
                      style={styles.primaryActionBtn}
                      onPress={() => setActiveTab('search')}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.primaryActionBtnText}>Adjust Pin on Interactive Map</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondaryActionBtn}
                      onPress={() => setEstimateStep('selection')}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.secondaryActionBtnText}>Change Location or Zoning</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()
          ) : null}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollBody: {
    padding: 16,
    gap: 16,
  },
  stepTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  stepTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  stepTabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  stepTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  stepTabTextActive: {
    color: '#240046',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D4AF37',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
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
  changeLocBtn: {
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  changeLocBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#240046',
  },
  usageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  usageChipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  usageChipBtnActive: {
    backgroundColor: '#240046',
    borderColor: '#D4AF37',
  },
  usageChipBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  usageChipBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  unitToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  unitToggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  unitPillBox: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  unitPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  unitPillActive: {
    backgroundColor: '#240046',
  },
  unitPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  unitPillTextActive: {
    color: '#FFFFFF',
  },
  advancedDrawerToggle: {
    marginTop: 14,
    paddingVertical: 6,
    alignItems: 'center',
  },
  advancedDrawerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  advancedDrawerContent: {
    backgroundColor: '#FAF5FF',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  coordInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputMiniLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  coordTextInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
  },
  applyCoordBtn: {
    backgroundColor: '#240046',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  applyCoordBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  primaryActionBtn: {
    backgroundColor: '#240046',
    borderRadius: 14,
    paddingVertical: 14,
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
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryActionBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
  },
  secondaryActionBtnText: {
    color: '#240046',
    fontSize: 13,
    fontWeight: '700',
  },
  exportPdfBtn: {
    backgroundColor: '#240046',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4AF37',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  exportPdfBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    gap: 8,
  },
  loadingCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  loadingCardSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 8,
  },
  errorCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#991B1B',
  },
  errorCardSub: {
    fontSize: 12.5,
    color: '#B91C1C',
    lineHeight: 18,
  },
  valuationHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  valHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  valTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  valLocalityTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  confidencePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  confidencePillHigh: {
    backgroundColor: '#FEFCE8',
    borderColor: '#FDE68A',
  },
  confidencePillModerate: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  confidencePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  bigRateDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 16,
  },
  bigRateNumber: {
    fontSize: 32,
    fontWeight: '900',
    color: '#240046',
    letterSpacing: -0.5,
  },
  bigRateUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginLeft: 6,
  },
  convertedRateSub: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    marginBottom: 16,
  },
  rangesGrid: {
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rangeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rangeBoxLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  rangeBoxVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  estimateDisclaimer: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 14,
    lineHeight: 14,
  },
  guidelineCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  guidelineTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  guidelineTag: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1E40AF',
    textTransform: 'uppercase',
  },
  guidelineSubTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
    marginTop: 1,
  },
  guidelineRateVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  guidelineNotice: {
    fontSize: 10.5,
    color: '#1E40AF',
    marginTop: 8,
    lineHeight: 14,
  },
  insufficientDataCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  insufficientBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCD34D',
    marginBottom: 8,
  },
  insufficientBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
    textTransform: 'uppercase',
  },
  insufficientTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
  },
  insufficientSub: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 17,
  },
  insufficientAdvice: {
    fontSize: 11.5,
    color: '#92400E',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

