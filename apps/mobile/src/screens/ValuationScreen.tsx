import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import Feather from '@expo/vector-icons/Feather';
import { Premium as P } from '../theme/premium';
import { ScreenUI, withScreenStyles } from '../theme/screenUI';
import { ScreenEntrance } from '../components/ScreenEntrance';
import { PremiumChoice } from '../components/PremiumChoice';
import { PremiumPressable } from '../components/PremiumPressable';
import { useReducedMotion } from '../hooks/useReducedMotion';
import React, { useRef } from 'react';
import { ResearchAreaFields } from '../components/ResearchAreaFields';
import { MarketEvidenceCard } from '../components/MarketEvidenceCard';
import { BrokerPriceRangeCard } from '../components/BrokerPriceRangeCard';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Colors } from '../theme/colors';
import {
  LAND_USAGES,
  formatLakhs,
  calculateMarketRateBuffer,
  convertCentToAcreRate,
  formatRateForUnit,
  ROAD_FRONTAGE_OPTIONS,
  AMENITY_OPTIONS,
} from '../utils/formatters';
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
  activeDistrict?: string;
  researchArea: string; setResearchArea: (value: string) => void; researchAreaUnit: string; setResearchAreaUnit: (value: string) => void;
  targetLat: number;
  targetLng: number;
  landUsage: number;
  setLandUsage: (id: number) => void;
  selectedRoadFrontage: string;
  setSelectedRoadFrontage: (road: string) => void;
  selectedAmenities: string;
  setSelectedAmenities: (amenities: string) => void;
  displayUnit: 'Cent' | 'SqFt' | 'Acre';
  setDisplayUnit: (u: 'Cent' | 'SqFt' | 'Acre') => void;
  showAdvancedCoords: boolean;
  setShowAdvancedCoords: (s: boolean) => void;
  latInput: string;
  setLatInput: (s: string) => void;
  lngInput: string;
  setLngInput: (s: string) => void;
  handleManualCoordSubmit: () => void;
  executeCalculation: (lat: number, lng: number, usage: number, road?: string, amenities?: string) => void;
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
  activeDistrict, researchArea, setResearchArea, researchAreaUnit, setResearchAreaUnit,
  targetLat,
  targetLng,
  landUsage,
  setLandUsage,
  selectedRoadFrontage,
  setSelectedRoadFrontage,
  selectedAmenities,
  setSelectedAmenities,
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
  const scrollRef = useRef<any>(null);
  const { reduced } = useReducedMotion();
  const { width, fontScale } = useWindowDimensions();
  const isCompact = width < 370;
  const stackLocationHeader = width / fontScale < 640 || activeLocality.length > 32;
  const [showEvidenceDetails, setShowEvidenceDetails] = React.useState(false);
  React.useEffect(() => setShowEvidenceDetails(false), [estimate]);
  return (
    <ScrollView ref={scrollRef}
      style={{ flex: 1, backgroundColor: P.background }}
      contentContainerStyle={[styles.scrollBody, isCompact && { paddingHorizontal: 14, paddingTop: 14 }, { paddingBottom: 24 + bottomInset }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled={true}
    >
      <ScreenEntrance>
        <View style={styles.stepTabsRow}>
          <PremiumChoice variant="segment" label="1. Location & Zoning" selected={estimateStep === 'selection'} onPress={() => setEstimateStep('selection')} />
          <PremiumChoice variant="segment" label="2. Valuation Result" selected={estimateStep === 'result'} onPress={() => { if (estimate) setEstimateStep('result'); else executeCalculation(targetLat, targetLng, landUsage); }} />
        </View>

        {/* STEP 1: SELECTION */}
        {estimateStep === 'selection' && (
          <View style={[styles.card, isCompact && { padding: 14 }]}>
            {/* Target Location Header */}
            <View style={[styles.cardHeaderRow, stackLocationHeader && styles.locationHeaderStacked]}>
              <View style={[styles.locationSummary, stackLocationHeader && styles.locationSummaryStacked]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Feather accessible={false} name="map-pin" size={15} color={P.purple} /><Text style={styles.cardSectionLabel}>TARGET LOCATION</Text></View>
                <Text style={styles.cardTitle}>{activeLocality}</Text>
                <Text style={styles.cardSubtitle}>
                  {targetLat.toFixed(4)}° N, {targetLng.toFixed(4)}° E{activeDistrict ? ` · ${activeDistrict}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.changeLocBtn, stackLocationHeader && styles.changeLocBtnStacked]}
                onPress={() => setActiveTab('search')}
                activeOpacity={0.8}
              >
                <Text style={styles.changeLocBtnText}>Change on Map</Text>
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
                  <PremiumChoice key={u.id} label={u.label} selected={isSelected} onPress={() => setLandUsage(u.id)} />
                );
              })}
            </View>

            <View style={styles.cardDivider} />

            <ResearchAreaFields area={researchArea} unit={researchAreaUnit} onArea={setResearchArea} onUnit={setResearchAreaUnit} />
            <View style={styles.cardDivider} />

            {/* Road Frontage & Width Multiplier */}
            <Text style={styles.cardSectionLabel}>ROAD FRONTAGE & ACCESS WIDTH</Text>
            <Text style={styles.cardSubtitle}>Choose the access type that matches the property and its supporting records:</Text>

            <View style={styles.optionsWrapRow}>
              {ROAD_FRONTAGE_OPTIONS.map((opt) => {
                const isSelected = selectedRoadFrontage === opt.id;
                return (
                  <PremiumChoice key={opt.id} label={opt.label} selected={isSelected} onPress={() => setSelectedRoadFrontage(opt.id)} />
                );
              })}
            </View>

            <View style={styles.cardDivider} />

            {/* Surrounding Civic & Social Anchors */}
            <Text style={styles.cardSectionLabel}>SURROUNDING CIVIC & TRANSIT ANCHORS</Text>
            <Text style={styles.cardSubtitle}>Proximity to bus stands, hospitals & schools drives local demand:</Text>

            <View style={styles.optionsWrapRow}>
              {AMENITY_OPTIONS.map((opt) => {
                const isSelected = selectedAmenities === opt.id;
                return (
                  <PremiumChoice key={opt.id} label={opt.label} selected={isSelected} onPress={() => setSelectedAmenities(opt.id)} />
                );
              })}
            </View>

            {/* Collapsible Advanced Coordinates Drawer */}
            <TouchableOpacity
              accessibilityRole="button" accessibilityState={{ expanded: showAdvancedCoords }}
              style={styles.advancedDrawerToggle}
              onPress={() => setShowAdvancedCoords(!showAdvancedCoords)}
            >
              <Text style={styles.advancedDrawerText}>
                {showAdvancedCoords ? 'Hide coordinate inputs' : 'Manual coordinate override'}
              </Text>
            </TouchableOpacity>

            {showAdvancedCoords && (
              <View style={styles.advancedDrawerContent}>
                <View style={styles.coordInputsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputMiniLabel}>Latitude</Text>
                    <TextInput
                      accessibilityLabel="Override latitude"
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
                      accessibilityLabel="Override longitude"
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
            <PremiumPressable reducedMotion={reduced}
              style={[styles.primaryActionBtn, { marginTop: 16 }]}
              onPress={() => executeCalculation(targetLat, targetLng, landUsage, selectedRoadFrontage, selectedAmenities)}
            >
              <Text style={styles.primaryActionBtnText}>Calculate Land Valuation</Text>
            </PremiumPressable>
          </View>
        )}

        {/* STEP 2: VALUATION RESULTS */}
        {estimateStep === 'result' && (
          <>
            {!loadingEstimate && estimate?.status !== 'Success' && (
              <BrokerPriceRangeCard
                area={Number(researchArea) > 0 ? Number(researchArea) : undefined}
                areaUnit={researchAreaUnit}
                latitude={targetLat}
                longitude={targetLng}
                landUsage={landUsage}
                roadAccess={selectedRoadFrontage}
                displayUnit={displayUnit}
                onSelectUnit={setDisplayUnit}
                liveMarketComps={estimate?.liveMarketComps}
              />
            )}
            {!loadingEstimate && !estimateError && estimate?.guidelineLookupMessage && (
              <View accessibilityRole="alert" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <Text style={{ fontSize: 13, lineHeight: 20, color: '#92400E' }}>{estimate.guidelineLookupMessage}</Text>
              </View>
            )}
            {loadingEstimate ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingCardTitle}>Analyzing Verified Comparables...</Text>
                <Text style={styles.loadingCardSub}>
                  Checking nearby sale evidence and the available guideline benchmark. This may take a moment.
                </Text>
                <Text style={[styles.loadingCardSub, { fontSize: 11, color: '#94A3B8', marginTop: 4 }]}>
                  Filtering strictly verified completed-sale records. No artificial or guessed prices.
                </Text>
              </View>
            ) : estimateError ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorCardTitle}>Valuation Calculation Notice</Text>
                <Text style={styles.errorCardSub}>{estimateError}</Text>
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={() => executeCalculation(targetLat, targetLng, landUsage, selectedRoadFrontage, selectedAmenities)}
                >
                  <Text style={styles.primaryActionBtnText}>Retry Calculation</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryActionBtn, { marginTop: 8 }]}
                  onPress={() => setEstimateStep('selection')}
                >
                  <Text style={styles.secondaryActionBtnText}>Back to Location & Zoning</Text>
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
                const asking = estSuccess.askingPriceReference;

                return (
                  <>
                    {/* Section 1: Completed Transaction Evidence */}
                    <View style={styles.valuationHeroCard}>
                      <View style={styles.valHeaderRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.valTag}>
                            Transaction-Based Market Estimate
                          </Text>
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
                            {estSuccess.confidence} Confidence ({estSuccess.comparableRecordCount} Verified Deeds)
                          </Text>
                        </View>
                      </View>

                      {(() => {
                        const activeUnit = displayUnit === 'Cent' ? 'Cent' : displayUnit === 'SqFt' ? 'Sq.Ft' : 'Acre';
                        const activeRate = displayUnit === 'Cent' ? medianCent : displayUnit === 'SqFt' ? medianSqFt : convertCentToAcreRate(medianCent);
                        const activeBuffer = calculateMarketRateBuffer(activeRate, activeUnit);
                        const altUnit = displayUnit === 'Acre' ? 'Cent' : displayUnit === 'Cent' ? 'Sq.Ft' : 'Cent';
                        const altRate = displayUnit === 'Acre' ? medianCent : displayUnit === 'Cent' ? medianSqFt : medianCent;
                        const altBuffer = calculateMarketRateBuffer(altRate, altUnit);

                        const typicalLow = displayUnit === 'Cent' ? formatLakhs(iqrCent25) : displayUnit === 'SqFt' ? `₹${Math.round(iqrSqFt25).toLocaleString('en-IN')}` : formatRateForUnit(convertCentToAcreRate(iqrCent25), 'Acre');
                        const typicalHigh = displayUnit === 'Cent' ? formatLakhs(iqrCent75) : displayUnit === 'SqFt' ? `₹${Math.round(iqrSqFt75).toLocaleString('en-IN')}` : formatRateForUnit(convertCentToAcreRate(iqrCent75), 'Acre');
                        const observedLow = displayUnit === 'Cent' ? formatLakhs(minCent) : displayUnit === 'SqFt' ? `₹${Math.round(minSqFt).toLocaleString('en-IN')}` : formatRateForUnit(convertCentToAcreRate(minCent), 'Acre');
                        const observedHigh = displayUnit === 'Cent' ? formatLakhs(maxCent) : displayUnit === 'SqFt' ? `₹${Math.round(maxSqFt).toLocaleString('en-IN')}` : formatRateForUnit(convertCentToAcreRate(maxCent), 'Acre');

                        return (
                          <>
                            {/* Unit Switcher */}
                            <View style={styles.valUnitToggleRow}>
                              <Text style={styles.valUnitToggleLabel}>Display Unit:</Text>
                              <View style={styles.valUnitPillBox}>
                                {(['Cent', 'SqFt', 'Acre'] as const).map((unit) => {
                                  const isSelected = displayUnit === unit;
                                  const label = unit === 'Cent' ? 'Cent' : unit === 'SqFt' ? 'Sq.Ft' : 'Acre';
                                  return (
                                    <TouchableOpacity
                                      key={unit}
                                      accessibilityRole="button"
                                      accessibilityLabel={`Display in ${label}`}
                                      accessibilityState={{ selected: isSelected }}
                                      onPress={() => setDisplayUnit(unit)}
                                      style={[styles.valUnitPill, isSelected && styles.valUnitPillActive]}
                                      activeOpacity={0.7}
                                    >
                                      <Text style={[styles.valUnitPillText, isSelected && styles.valUnitPillTextActive]}>
                                        {label}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </View>

                            {/* Estimated Range Market Buffer Banner */}
                            <View style={styles.estimatedRangeBanner}>
                              <Text style={styles.estimatedRangeLabel}>Estimated Range</Text>
                              <Text style={styles.estimatedRangeVal}>
                                {activeBuffer.rangeFormatted} / {activeUnit}
                              </Text>
                            </View>

                            {/* Rate Display with Approximate Market Rate Anchor */}
                            <View style={styles.bigRateDisplay}>
                              <View>
                                <Text style={styles.approxRateLabel}>Approximate Market Rate</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                  <Text style={styles.bigRateNumber}>
                                    {activeBuffer.approximateFormatted}
                                  </Text>
                                  <Text style={styles.bigRateUnit}>
                                    / {activeUnit}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            <Text style={styles.convertedRateSub}>
                              Equivalent to approx. {altBuffer.approximateFormatted} / {altUnit}{displayUnit === 'Acre' ? ' (retail)' : ''}
                            </Text>

                            {/* Range Metrics */}
                            <View style={styles.rangesGrid}>
                              <View style={styles.rangeBox}>
                                <Text style={styles.rangeBoxLabel}>Estimated Range (Buffer)</Text>
                                <Text style={[styles.rangeBoxVal, { color: '#240046', fontWeight: '800' }]}>
                                  {activeBuffer.rangeFormatted}
                                </Text>
                              </View>
                              <View style={styles.rangeBox}>
                                <Text style={styles.rangeBoxLabel}>Typical Range (25th–75th)</Text>
                                <Text style={styles.rangeBoxVal}>
                                  {typicalLow} – {typicalHigh}
                                </Text>
                              </View>
                              <View style={styles.rangeBox}>
                                <Text style={styles.rangeBoxLabel}>Observed Range (Min–Max)</Text>
                                <Text style={styles.rangeBoxVal}>
                                  {observedLow} – {observedHigh}
                                </Text>
                              </View>
                            </View>
                          </>
                        );
                      })()}

                      <Text style={styles.estimateDisclaimer}>
                        {estSuccess.disclaimer ||
                          'Indicative statistical estimate derived strictly from recent 1,000m verified comparables; not an official legal appraisal or guaranteed sale price.'}
                      </Text>
                    </View>

                    {/* Micro-Location Attributes / Breakdown */}
                    {estSuccess.factorBreakdown && (
                      <View style={styles.breakdownCard}>
                        <View style={styles.breakdownHeaderRow}>
                          <Text style={styles.breakdownTitle}> Micro-Location Context</Text>
                          <View style={styles.breakdownBadgePill}>
                            <Text style={styles.breakdownBadgeText}>Attributes</Text>
                          </View>
                        </View>
                        <Text style={styles.breakdownNotice}>
                          Selected road hierarchy and civic proximity parameters:
                        </Text>

                        {estSuccess.factorBreakdown.baseLocalityRatePerCent > 0 ? (
                          <>
                            <View style={styles.breakdownRow}>
                              <Text style={styles.breakdownKey}>Base Locality Rate:</Text>
                              <Text style={styles.breakdownVal}>
                                {formatLakhs(estSuccess.factorBreakdown.baseLocalityRatePerCent)} / Cent
                              </Text>
                            </View>

                            <View style={styles.breakdownRow}>
                              <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={styles.breakdownKey}>Road Frontage Impact:</Text>
                                <Text style={styles.breakdownSub}>
                                  {estSuccess.factorBreakdown.roadFrontageType}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.breakdownVal,
                                  {
                                    color:
                                      estSuccess.factorBreakdown.roadFrontageAdjustmentPerCent >= 0
                                        ? '#15803D'
                                        : '#B91C1C',
                                  },
                                ]}
                              >
                                {estSuccess.factorBreakdown.roadFrontageAdjustmentPerCent >= 0 ? '+' : ''}
                                {formatLakhs(estSuccess.factorBreakdown.roadFrontageAdjustmentPerCent)} / Cent
                              </Text>
                            </View>

                            <View style={styles.breakdownRow}>
                              <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={styles.breakdownKey}>Civic Anchors & Transit:</Text>
                                <Text style={styles.breakdownSub}>
                                  {estSuccess.factorBreakdown.surroundingAmenitiesType}
                                </Text>
                              </View>
                              <Text style={[styles.breakdownVal, { color: '#805A13' }]}>
                                +{formatLakhs(estSuccess.factorBreakdown.amenitiesAdjustmentPerCent)} / Cent
                              </Text>
                            </View>

                            <View style={styles.breakdownDivider} />

                            <View style={styles.breakdownTotalRow}>
                              <Text style={styles.breakdownTotalLabel}>Net Market Valuation:</Text>
                              <Text style={styles.breakdownTotalVal}>
                                {displayUnit === 'Acre'
                                  ? `${formatRateForUnit(convertCentToAcreRate(medianCent), 'Acre')} / Acre`
                                  : displayUnit === 'SqFt'
                                    ? `₹${Math.round(medianSqFt).toLocaleString('en-IN')} / Sq.Ft`
                                    : `${formatLakhs(medianCent)} / Cent`}
                              </Text>
                            </View>
                          </>
                        ) : (
                          <>
                            <View style={styles.breakdownRow}>
                              <Text style={styles.breakdownKey}>Road Frontage:</Text>
                              <Text style={styles.breakdownVal}>
                                {estSuccess.factorBreakdown.roadFrontageType}
                              </Text>
                            </View>
                            <View style={styles.breakdownRow}>
                              <Text style={styles.breakdownKey}>Civic Anchors & Transit:</Text>
                              <Text style={styles.breakdownVal}>
                                {estSuccess.factorBreakdown.surroundingAmenitiesType}
                              </Text>
                            </View>
                          </>
                        )}
                      </View>
                    )}

                    {/* Section 2: Asking Price Benchmark */}
                    {asking && asking.listingCount > 0 && (
                      <View style={styles.askingCard}>
                        <View style={styles.askingTopRow}>
                          <View>
                            <Text style={styles.askingTag}>
                              {asking.sectionLabel || 'Asking Price Benchmark'}
                            </Text>
                            <Text style={styles.askingSubTitle}>
                              Active Seller Listings ({asking.listingCount} listings)
                            </Text>
                          </View>
                          <Text style={styles.askingRateVal}>
                            {displayUnit === 'Cent'
                              ? `${formatLakhs(asking.medianRatePerCent)} / Cent`
                              : displayUnit === 'SqFt'
                                ? `₹${Math.round(asking.medianRatePerSqFt).toLocaleString('en-IN')} / Sq.Ft`
                                : `${formatRateForUnit(convertCentToAcreRate(asking.medianRatePerCent), 'Acre')} / Acre`}
                          </Text>
                        </View>
                        <Text style={styles.askingNotice}>
                          {asking.notice ||
                            'Seller asking prices from active listings. Kept strictly separate from verified completed transaction evidence.'}
                        </Text>
                      </View>
                    )}

                    {/* Section 3: Government Guideline Benchmark */}
                    {guideline && guideline.guidelineRatePerCent > 0 && (
                      <View style={styles.guidelineCard}>
                        <View style={styles.guidelineTopRow}>
                          <View>
                            <Text style={styles.guidelineTag}>
                              {guideline.sectionLabel || 'Government Guideline Benchmark'}
                            </Text>
                            <Text style={styles.guidelineSubTitle}>
                              TNREGINET Official Benchmark • {guideline.locality}
                            </Text>
                          </View>
                          <Text style={styles.guidelineRateVal}>
                            {displayUnit === 'Cent'
                              ? `${formatLakhs(guideline.guidelineRatePerCent)} / Cent`
                              : displayUnit === 'SqFt'
                                ? `₹${Math.round(guideline.guidelineRatePerSqFt).toLocaleString('en-IN')} / Sq.Ft`
                                : `${formatRateForUnit(convertCentToAcreRate(guideline.guidelineRatePerCent), 'Acre')} / Acre`}
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
                          Export valuation report
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
                const asking = insuff.askingPriceReference;

                const liveComps = insuff.liveMarketComps;

                return (
                  <>
                    {/* Section 1: Completed Transaction Evidence / Live Market Comps */}
                    {liveComps ? (
                      <MarketEvidenceCard data={liveComps} displayUnit={displayUnit} />
                    ) : (
                      <View style={styles.insufficientDataCard}>
                        <View style={styles.insufficientBadge}>
                          <Text style={styles.insufficientBadgeText}>
                            {insuff.sectionLabel || 'Completed Transaction Evidence'}
                          </Text>
                        </View>
                        <Text style={styles.insufficientTitle}>
                          {insuff.comparableRecordsFound} comparable sales found
                        </Text>
                        <Text style={styles.insufficientSub}>
                          At least {insuff.minimumRequiredRecords || 3} verified sales are needed for a registered-sale estimate.
                        </Text>
                        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showEvidenceDetails }} style={styles.evidenceDetailsButton} onPress={() => setShowEvidenceDetails((value: boolean) => !value)}>
                          <Text style={styles.evidenceDetailsText}>{showEvidenceDetails ? 'Hide details −' : 'Why this estimate is unavailable +'}</Text>
                        </TouchableOpacity>
                        {showEvidenceDetails && <View>
                          <Text style={styles.insufficientSub}>{insuff.message || `Search radius: ${insuff.searchRadiusMeters || 1000} metres · ${currentUsageObj.label} land.`}</Text>
                          <Text style={styles.insufficientNoticeHighlight}>
                            Registered-sale estimates require enough verified deed evidence.
                          </Text>

                          {insuff.recommendations && insuff.recommendations.length > 0 && (
                            <View style={styles.recommendationsBox}>
                              <Text style={styles.recommendationsHeader}>Next Steps & Guidance:</Text>
                              {insuff.recommendations.map((rec, idx) => (
                                <View key={idx} style={styles.recommendationItem}>
                                  <Text style={styles.recommendationBullet}>•</Text>
                                  <Text style={styles.recommendationText}>{rec}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>}
                      </View>
                    )}

                    {/* Section 2: Asking Price Benchmark */}
                    {asking && asking.listingCount > 0 && (
                      <View style={styles.askingCard}>
                        <View style={styles.askingTopRow}>
                          <View>
                            <Text style={styles.askingTag}>
                              {asking.sectionLabel || 'Asking Price Benchmark'}
                            </Text>
                            <Text style={styles.askingSubTitle}>
                              Active Seller Listings ({asking.listingCount} listings)
                            </Text>
                          </View>
                          <Text style={styles.askingRateVal}>
                            {displayUnit === 'Cent'
                              ? `${formatLakhs(asking.medianRatePerCent)} / Cent`
                              : displayUnit === 'SqFt'
                                ? `₹${Math.round(asking.medianRatePerSqFt).toLocaleString('en-IN')} / Sq.Ft`
                                : `${formatRateForUnit(convertCentToAcreRate(asking.medianRatePerCent), 'Acre')} / Acre`}
                          </Text>
                        </View>
                        <Text style={styles.askingNotice}>
                          {asking.notice ||
                            'Seller asking prices from active listings. Kept strictly separate from verified completed transaction evidence.'}
                        </Text>
                      </View>
                    )}

                    {/* Section 3: Government Guideline Benchmark */}
                    {guideline && guideline.guidelineRatePerCent > 0 && (
                      <View style={styles.guidelineCard}>
                        <View style={styles.guidelineTopRow}>
                          <View>
                            <Text style={styles.guidelineTag}>
                              {guideline.sectionLabel || 'Government Guideline Benchmark'}
                            </Text>
                            <Text style={styles.guidelineSubTitle}>
                              TNREGINET Official Benchmark • {guideline.locality}
                            </Text>
                          </View>
                          <Text style={styles.guidelineRateVal}>
                            {displayUnit === 'Cent'
                              ? `${formatLakhs(guideline.guidelineRatePerCent)} / Cent`
                              : displayUnit === 'SqFt'
                                ? `₹${Math.round(guideline.guidelineRatePerSqFt).toLocaleString('en-IN')} / Sq.Ft`
                                : `${formatRateForUnit(convertCentToAcreRate(guideline.guidelineRatePerCent), 'Acre')} / Acre`}
                          </Text>
                        </View>
                        <Text style={styles.guidelineNotice}>
                          {guideline.legalNotice ||
                            'Government statutory minimum used for stamp duty registration. Kept strictly separate from open-market valuations.'}
                        </Text>
                      </View>
                    )}

                    {/* Action Buttons */}
                    <View style={{ gap: 8, marginTop: 14 }}>
                      {insuff.comparableRecordsFound > 0 && (
                        <TouchableOpacity
                          style={styles.primaryActionBtn}
                          onPress={() => {
                            setPreviousTab('estimate');
                            setActiveTab('records');
                          }}
                        >
                          <Text style={styles.primaryActionBtnText}>
                            View Available Comparables ({insuff.comparableRecordsFound})
                          </Text>
                        </TouchableOpacity>
                      )}

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
      </ScreenEntrance>
    </ScrollView>
  );
};

const styles = withScreenStyles({
  evidenceDetailsButton: { minHeight: 44, justifyContent: 'center', marginTop: 4 },
  evidenceDetailsText: { fontSize: 13, fontWeight: '700', color: Colors.goldText },
  scrollBody: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    padding: 20,
    gap: 18,
  },
  stepTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#EDEBF0',
    borderRadius: 6,
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
    shadowOpacity: 0,
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
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  locationHeaderStacked: { flexDirection: 'column', alignItems: 'stretch' },
  locationSummary: { flex: 1, minWidth: 0 },
  locationSummaryStacked: { flex: 0, width: '100%' },
  changeLocBtnStacked: { alignSelf: 'flex-start', maxWidth: '100%' },
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
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  primaryActionBtn: {
    backgroundColor: '#240046',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#240046',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  secondaryActionBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
  },
  secondaryActionBtnText: {
    color: '#240046',
    fontSize: 14,
    fontWeight: '600',
  },
  exportPdfBtn: {
    backgroundColor: '#240046',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4AF37',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 4,
    elevation: 3,
  },
  exportPdfBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
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
    borderRadius: 8,
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
    borderRadius: 8,
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
  valUnitToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  valUnitToggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  valUnitPillBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  valUnitPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valUnitPillActive: {
    backgroundColor: P.violet,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  valUnitPillText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  valUnitPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  estimatedRangeBanner: {
    backgroundColor: '#FAF5FF',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  estimatedRangeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7E22CE',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  estimatedRangeVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#240046',
  },
  approxRateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
    backgroundColor: '#F7F3FB',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DED4EB',
  },
  guidelineTopRow: {
    gap: 10,
    alignItems: 'flex-start',
  },
  guidelineTag: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#3B0764',
    textTransform: 'uppercase',
  },
  guidelineSubTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B0764',
    marginTop: 1,
  },
  guidelineRateVal: {
    fontSize: 23,
    fontWeight: '800',
    color: '#3B0764',
  },
  guidelineNotice: {
    fontSize: 12,
    color: '#3B0764',
    marginTop: 8,
    lineHeight: 19,
  },
  liveCompsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
    gap: 10,
  },
  liveCompsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  liveBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#059669',
  },
  liveBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#065F46',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fallbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  fallbackBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D97706',
  },
  fallbackBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tierPill: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  tierPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B21A8',
  },
  liveCompsRateRow: {
    marginTop: 2,
    marginBottom: 2,
  },
  liveCompsMainRate: {
    fontSize: 22,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: -0.3,
  },
  liveCompsSubRate: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#047857',
    marginTop: 2,
  },
  liveCompsLocalityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  liveCompsLocalityText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  landmarkChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  landmarkChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  portalBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  portalPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  portalPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  listingsCountText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  liveCompsSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
    marginTop: 4,
  },
  liveCompsSummaryText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  citationsSection: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    gap: 6,
  },
  citationsHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  citationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  citationItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  citationTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  citationPortal: {
    fontSize: 10.5,
    color: '#059669',
    fontWeight: '600',
    marginTop: 1,
  },
  insufficientDataCard: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 18, borderWidth: 1, borderColor: '#E5E2E9', borderLeftWidth: 2, borderLeftColor: '#D4AF37' },
  insufficientBadge: { alignSelf: 'flex-start', marginBottom: 10 },
  insufficientBadgeText: { fontSize: 10, fontWeight: '600', color: '#79717F', letterSpacing: .5, textTransform: 'uppercase' },
  insufficientTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
  },
  insufficientSub: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 21,
  },
  insufficientAdvice: {
    fontSize: 11.5,
    color: '#92400E',
    marginTop: 8,
    fontStyle: 'italic',
  },
  insufficientNoticeHighlight: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#92400E',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    lineHeight: 16,
  },
  recommendationsBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  recommendationsHeader: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#78350F',
    marginBottom: 6,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  recommendationBullet: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '700',
    lineHeight: 16,
  },
  recommendationText: {
    flex: 1,
    fontSize: 11.5,
    color: '#78350F',
    lineHeight: 16,
  },
  askingCard: {
    backgroundColor: '#FFFDF5',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFE2B2',
  },
  askingTopRow: {
    gap: 10,
    alignItems: 'flex-start',
  },
  askingTag: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#805A13',
    textTransform: 'uppercase',
  },
  askingSubTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#805A13',
    marginTop: 1,
  },
  askingRateVal: {
    fontSize: 23,
    fontWeight: '800',
    color: '#805A13',
  },
  askingNotice: {
    fontSize: 12,
    color: '#805A13',
    marginTop: 8,
    lineHeight: 19,
  },
  optionsWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  factorChipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  factorChipBtnActive: {
    backgroundColor: '#FAF5FF',
    borderColor: '#A855F7',
  },
  factorChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  factorChipTextActive: {
    color: '#7E22CE',
    fontWeight: '700',
  },
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  breakdownHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  breakdownBadgePill: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  breakdownBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#7E22CE',
    textTransform: 'uppercase',
  },
  breakdownNotice: {
    fontSize: 10.5,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 14,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  breakdownKey: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  breakdownSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  breakdownVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  breakdownTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  breakdownTotalLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#240046',
  },
  breakdownTotalVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#7E22CE',
  },
}, {
  card: ScreenUI.card, cardHeaderRow: { flexWrap: 'wrap', gap: 14 }, cardTitle: { color: P.text, fontSize: 20, lineHeight: 28 }, cardSubtitle: { ...ScreenUI.subtitle, marginTop: 5 }, cardSectionLabel: { ...ScreenUI.section, marginBottom: 4 }, cardDivider: { backgroundColor: P.border, marginVertical: 22 },
  stepTabsRow: ScreenUI.segments, stepTabBtn: ScreenUI.segment, stepTabBtnActive: ScreenUI.segmentActive, stepTabText: ScreenUI.segmentText, stepTabTextActive: ScreenUI.segmentTextActive,
  changeLocBtn: ScreenUI.secondary, changeLocBtnText: ScreenUI.secondaryText,
  unitToggleRow: { flexWrap: 'wrap', gap: 12, borderTopColor: P.border }, unitPillBox: ScreenUI.segments, unitPill: ScreenUI.segment, unitPillActive: ScreenUI.segmentActive, unitPillText: ScreenUI.segmentText, unitPillTextActive: ScreenUI.segmentTextActive,
  advancedDrawerToggle: { minHeight: 46, paddingVertical: 12, borderColor: P.border }, advancedDrawerText: { color: P.purple, fontSize: 13 }, advancedDrawerContent: { backgroundColor: P.lavender, borderRadius: 14, padding: 14 }, coordInputsRow: { flexWrap: 'wrap', gap: 12 }, coordTextInput: ScreenUI.input, applyCoordBtn: ScreenUI.secondary, applyCoordBtnText: ScreenUI.secondaryText,
  primaryActionBtn: ScreenUI.primary, primaryActionBtnText: ScreenUI.primaryText, secondaryActionBtn: ScreenUI.secondary, secondaryActionBtnText: ScreenUI.secondaryText,
  valuationHeroCard: { ...ScreenUI.card, borderTopWidth: 2, borderTopColor: P.gold }, valHeaderRow: { flexWrap: 'wrap', gap: 12 }, valLocalityTitle: { color: P.text, fontSize: 20 }, estimatedRangeBanner: { flexWrap: 'wrap', gap: 12, borderRadius: 14, backgroundColor: P.lavender, borderColor: P.border },
  guidelineCard: { ...ScreenUI.card, backgroundColor: P.lavender }, askingCard: { ...ScreenUI.card, backgroundColor: '#FFFCF4' }, insufficientDataCard: { ...ScreenUI.card, borderLeftWidth: 2, borderLeftColor: P.gold }, liveCompsCard: { ...ScreenUI.card, borderLeftWidth: 4, borderLeftColor: '#059669', borderColor: '#10B981' },
  guidelineSubTitle: { color: P.violet, fontSize: 13, lineHeight: 20 }, askingSubTitle: { fontSize: 13, lineHeight: 20 }, estimateDisclaimer: { ...ScreenUI.subtitle, fontSize: 12 }, breakdownCard: ScreenUI.card, loadingCard: ScreenUI.card,
});

