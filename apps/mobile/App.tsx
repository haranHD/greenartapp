import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  mobileApi,
  EstimateApiResponse,
  EstimateSuccessResponse,
  EstimateInsufficientDataResponse,
} from './src/services/api';

// =========================================================================
// Error Boundary (Guarantees no white screens under any circumstances)
// =========================================================================
interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class SafeErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Greenart Mobile Error Boundary caught an error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.errorContainer}>
          <Text style={styles.errorHeader}>Valuation Module Notice</Text>
          <Text style={styles.errorSubtext}>{this.state.errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => this.setState({ hasError: false, errorMessage: '' })}
          >
            <Text style={styles.retryBtnText}>Reload Valuation Screen</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

// =========================================================================
// Pilot Hotspots Definition
// =========================================================================
interface PilotHotspot {
  id: string;
  name: string;
  taluk: string;
  records: number;
  lat: number;
  lng: number;
  mapX: number; // percentage on map canvas
  mapY: number;
}

const PILOT_HOTSPOTS: PilotHotspot[] = [
  {
    id: 'kannampalayam',
    name: 'Kannampalayam',
    taluk: 'Sulur Taluk',
    records: 5,
    lat: 11.0012,
    lng: 77.0874,
    mapX: 48,
    mapY: 62,
  },
  {
    id: 'sulur',
    name: 'Sulur Corridor',
    taluk: 'Sulur Taluk',
    records: 4,
    lat: 11.0264,
    lng: 77.1275,
    mapX: 74,
    mapY: 48,
  },
  {
    id: 'saravanampatti',
    name: 'Saravanampatti',
    taluk: 'Coimbatore North',
    records: 4,
    lat: 11.0805,
    lng: 76.9976,
    mapX: 32,
    mapY: 20,
  },
  {
    id: 'sparse',
    name: 'Out-of-Pilot (Test)',
    taluk: 'Rural Sector',
    records: 0,
    lat: 10.66,
    lng: 77.01,
    mapX: 20,
    mapY: 86,
  },
];

// =========================================================================
// Main Application Component
// =========================================================================
function GreenartMobileApp() {
  const [latInput, setLatInput] = useState<string>('11.0012');
  const [lngInput, setLngInput] = useState<string>('77.0874');
  const [activeLocality, setActiveLocality] = useState<string>('Kannampalayam');
  const [landUsage, setLandUsage] = useState<number>(1); // 1=Residential, 2=Commercial, 3=Agri
  const [displayUnit, setDisplayUnit] = useState<'Cent' | 'SqFt'>('Cent');

  const [loading, setLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<EstimateApiResponse | null>(null);

  const fetchEstimate = async (latitude: number, longitude: number, usage: number = landUsage) => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await mobileApi.calculateEstimate(latitude, longitude, usage, 1000);
      setEstimate(res);
    } catch (err: any) {
      setApiError(err.message || 'Unable to connect to PostGIS engine on port 5039');
      setEstimate(null);
    } finally {
      setLoading(false);
    }
  };

  // Initial estimate on mount
  useEffect(() => {
    fetchEstimate(11.0012, 77.0874, landUsage);
  }, []);

  const handleSelectHotspot = (spot: PilotHotspot) => {
    setActiveLocality(spot.name);
    setLatInput(spot.lat.toFixed(4));
    setLngInput(spot.lng.toFixed(4));
    fetchEstimate(spot.lat, spot.lng, landUsage);
  };

  const handleManualCalculate = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng)) {
      setApiError('Please enter valid numeric latitude and longitude.');
      return;
    }
    setActiveLocality('Custom Coordinates');
    fetchEstimate(lat, lng, landUsage);
  };

  const handleUsageChange = (newUsage: number) => {
    setLandUsage(newUsage);
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!isNaN(lat) && !isNaN(lng)) {
      fetchEstimate(lat, lng, newUsage);
    }
  };

  const formatLakhs = (val?: number): string => {
    if (val === undefined || val === null || isNaN(val)) return '—';
    if (val >= 100000) {
      const lakhs = val / 100000;
      return `₹${lakhs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
    }
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  const currentLat = parseFloat(latInput) || 11.0012;
  const currentLng = parseFloat(lngInput) || 77.0874;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1b5e20" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brandTitle}>GREENART PROPERTIES</Text>
            <Text style={styles.brandSubtitle}>Land Market Rate Analyst</Text>
          </View>
          <View style={styles.pilotBadge}>
            <View style={styles.greenPulseDot} />
            <Text style={styles.pilotBadgeText}>Coimbatore Pilot</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hotspots Selection Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Coimbatore Pilot Locations</Text>
          <Text style={styles.cardSubtitle}>
            Tap a verified hub to evaluate market rates within a 1,000m PostGIS buffer:
          </Text>

          <View style={styles.hotspotGrid}>
            {PILOT_HOTSPOTS.map((spot) => {
              const isSelected = activeLocality === spot.name;
              return (
                <TouchableOpacity
                  key={spot.id}
                  style={[styles.hotspotBtn, isSelected && styles.hotspotBtnActive]}
                  onPress={() => handleSelectHotspot(spot)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.hotspotBtnName, isSelected && styles.hotspotBtnNameActive]}>
                    {spot.name}
                  </Text>
                  <Text style={[styles.hotspotBtnSub, isSelected && styles.hotspotBtnSubActive]}>
                    {spot.taluk} ({spot.records} records)
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Interactive Map Visualizer */}
          <View style={styles.mapCanvasBox}>
            <View style={styles.mapCanvasHeader}>
              <Text style={styles.mapCanvasTitle}>Interactive Location Pin</Text>
              <Text style={styles.mapCanvasRadius}>Radius: 1,000m buffer</Text>
            </View>

            <View style={styles.mapCanvas}>
              {/* Background grid lines */}
              <View style={styles.gridLineH} />
              <View style={styles.gridLineV} />

              {/* Pilot Hotspots On Map */}
              {PILOT_HOTSPOTS.map((spot) => {
                const isSelected = activeLocality === spot.name;
                return (
                  <TouchableOpacity
                    key={`map-${spot.id}`}
                    style={[
                      styles.mapHotspotPin,
                      { left: `${spot.mapX}%`, top: `${spot.mapY}%` },
                      isSelected && styles.mapHotspotPinSelected,
                    ]}
                    onPress={() => handleSelectHotspot(spot)}
                    activeOpacity={0.8}
                  >
                    {isSelected && <View style={styles.bufferCircle} />}
                    <View style={[styles.pinPoint, isSelected && styles.pinPointActive]} />
                    <Text style={[styles.mapPinLabel, isSelected && styles.mapPinLabelActive]}>
                      {spot.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <View style={styles.compassBox}>
                <Text style={styles.compassText}>N ↑</Text>
              </View>
            </View>

            <Text style={styles.mapCanvasFooter}>
              Selected Target: {currentLat.toFixed(4)}° N, {currentLng.toFixed(4)}° E
            </Text>
          </View>

          {/* Manual Coordinate Bar */}
          <View style={styles.coordBar}>
            <View style={styles.coordInputGroup}>
              <Text style={styles.coordInputLabel}>Latitude</Text>
              <TextInput
                style={styles.coordInputField}
                value={latInput}
                onChangeText={setLatInput}
                placeholder="11.0012"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.coordInputGroup}>
              <Text style={styles.coordInputLabel}>Longitude</Text>
              <TextInput
                style={styles.coordInputField}
                value={lngInput}
                onChangeText={setLngInput}
                placeholder="77.0874"
                keyboardType="numeric"
              />
            </View>
            <TouchableOpacity
              style={styles.calculateBtn}
              onPress={handleManualCalculate}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.calculateBtnText}>Calculate</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Land Usage Chips */}
          <View style={styles.usageContainer}>
            <Text style={styles.usageHeading}>Land Classification:</Text>
            <View style={styles.usageRow}>
              {[
                { id: 1, label: 'Residential' },
                { id: 2, label: 'Commercial' },
                { id: 3, label: 'Agricultural' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.usageChip, landUsage === item.id && styles.usageChipActive]}
                  onPress={() => handleUsageChange(item.id)}
                >
                  <Text
                    style={[
                      styles.usageChipText,
                      landUsage === item.id && styles.usageChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* API Error Box */}
        {apiError && (
          <View style={styles.apiErrorBox}>
            <Text style={styles.apiErrorTitle}>Valuation Query Error</Text>
            <Text style={styles.apiErrorText}>{apiError}</Text>
          </View>
        )}

        {/* Loading Spinner */}
        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#1b5e20" />
            <Text style={styles.loadingMessage}>
              Querying PostGIS 1,000m radius & computing Median/IQR statistics...
            </Text>
          </View>
        )}

        {/* Valuation Result: Success */}
        {!loading && estimate && estimate.status === 'Success' && (
          <SuccessCard
            data={estimate as EstimateSuccessResponse}
            displayUnit={displayUnit}
            setDisplayUnit={setDisplayUnit}
            formatLakhs={formatLakhs}
          />
        )}

        {/* Valuation Result: Insufficient Data */}
        {!loading && estimate && estimate.status === 'InsufficientData' && (
          <InsufficientCard
            data={estimate as EstimateInsufficientDataResponse}
            onSelectLocality={handleSelectHotspot}
          />
        )}

        {/* Regulatory & Methodology Card */}
        <View style={styles.methodologyCard}>
          <Text style={styles.methodologyHeading}>Core Valuation Principles</Text>
          <Text style={styles.methodologyText}>
            • <Text style={styles.boldSpan}>Independent Target:</Text> Property search coordinates
            are independent of your device's physical GPS.
          </Text>
          <Text style={styles.methodologyText}>
            • <Text style={styles.boldSpan}>PostGIS Spatial Radius:</Text> Strict 1,000-metre geodesic
            distance query using PostgreSQL GIST indexing.
          </Text>
          <Text style={styles.methodologyText}>
            • <Text style={styles.boldSpan}>Guideline Value Isolation:</Text> Official government
            guideline rates are presented strictly for statutory comparison and never mixed into
            market estimates.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// =========================================================================
// Subcomponent: Success Valuation Card
// =========================================================================
function SuccessCard({
  data,
  displayUnit,
  setDisplayUnit,
  formatLakhs,
}: {
  data: EstimateSuccessResponse;
  displayUnit: 'Cent' | 'SqFt';
  setDisplayUnit: (unit: 'Cent' | 'SqFt') => void;
  formatLakhs: (v?: number) => string;
}) {
  const isCent = displayUnit === 'Cent';
  const priceRange = isCent ? data.priceRangePerCent : data.priceRangePerSqFt;
  const unitLabel = isCent ? '/ Cent' : '/ Sq.Ft';

  if (!priceRange) return null;

  return (
    <View style={styles.resultCard}>
      <View style={styles.resultHeaderRow}>
        <View>
          <Text style={styles.resultBadgeText}>INDICATIVE MARKET RATE</Text>
          <Text style={styles.confidenceMeta}>
            Confidence:{' '}
            <Text
              style={{
                color:
                  data.confidence === 'High'
                    ? '#15803d'
                    : data.confidence === 'Moderate'
                      ? '#0284c7'
                      : '#b45309',
                fontWeight: '700',
              }}
            >
              {data.confidence || 'Moderate'}
            </Text>{' '}
            ({data.comparableRecordCount || 0} comparable records within 1,000m)
          </Text>
        </View>

        <View style={styles.unitToggleGroup}>
          <TouchableOpacity
            style={[styles.unitToggleBtn, isCent && styles.unitToggleBtnActive]}
            onPress={() => setDisplayUnit('Cent')}
          >
            <Text style={[styles.unitToggleBtnText, isCent && styles.unitToggleBtnTextActive]}>
              ₹/Cent
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.unitToggleBtn, !isCent && styles.unitToggleBtnActive]}
            onPress={() => setDisplayUnit('SqFt')}
          >
            <Text style={[styles.unitToggleBtnText, !isCent && styles.unitToggleBtnTextActive]}>
              ₹/Sq.Ft
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Rate Hero Box */}
      <View style={styles.mainRateHero}>
        <Text style={styles.mainRateHeroValue}>
          {isCent
            ? formatLakhs(priceRange.medianRate)
            : `₹${Math.round(priceRange.medianRate || 0).toLocaleString('en-IN')}`}
        </Text>
        <Text style={styles.mainRateHeroUnit}>{unitLabel} (Median Rate)</Text>
      </View>

      {/* Interquartile Range (IQR Spread) */}
      <View style={styles.iqrSpreadBox}>
        <Text style={styles.iqrSpreadHeader}>Central 50% Market Spread (IQR):</Text>
        <Text style={styles.iqrSpreadNumbers}>
          {isCent ? formatLakhs(priceRange.percentile25) : `₹${Math.round(priceRange.percentile25 || 0)}`}
          {'  —  '}
          {isCent ? formatLakhs(priceRange.percentile75) : `₹${Math.round(priceRange.percentile75 || 0)}`}{' '}
          {unitLabel}
        </Text>
        <Text style={styles.iqrSpreadFooter}>
          Extreme Range: {isCent ? formatLakhs(priceRange.minRate) : `₹${Math.round(priceRange.minRate || 0)}`} to{' '}
          {isCent ? formatLakhs(priceRange.maxRate) : `₹${Math.round(priceRange.maxRate || 0)}`}
        </Text>
      </View>

      {/* Source Breakdown */}
      {data.sourceBreakdown && data.sourceBreakdown.length > 0 && (
        <View style={styles.evidenceContainer}>
          <Text style={styles.evidenceTitle}>Comparable Evidence Pool:</Text>
          <View style={styles.evidencePills}>
            {data.sourceBreakdown.map((item, idx) => (
              <View key={idx} style={styles.evidencePill}>
                <Text style={styles.evidencePillText}>
                  {item.category}: <Text style={{ fontWeight: '700' }}>{item.count}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Government Guideline Benchmark */}
      {data.governmentGuidelineReference && (
        <View style={styles.guidelineCard}>
          <View style={styles.guidelineCardTop}>
            <Text style={styles.guidelineBadge}>GOVERNMENT GUIDELINE REFERENCE</Text>
            <Text style={styles.guidelineLocalityName}>
              {data.governmentGuidelineReference.locality}
            </Text>
          </View>
          <Text style={styles.guidelineRateText}>
            {formatLakhs(data.governmentGuidelineReference.guidelineRatePerCent)} / Cent{' '}
            <Text style={{ fontSize: 13, fontWeight: '400', color: '#78350f' }}>
              (₹{Math.round(data.governmentGuidelineReference.guidelineRatePerSqFt || 0)} / Sq.Ft)
            </Text>
          </Text>
          <Text style={styles.guidelineNoticeText}>
            Statutory registration benchmark only. Greenart valuation calculations never mix guideline
            values into open-market transaction pools.
          </Text>
        </View>
      )}

      {/* Disclaimer */}
      <Text style={styles.statutoryDisclaimer}>{data.disclaimer}</Text>
    </View>
  );
}

// =========================================================================
// Subcomponent: Insufficient Data Card
// =========================================================================
function InsufficientCard({
  data,
  onSelectLocality,
}: {
  data: EstimateInsufficientDataResponse;
  onSelectLocality: (spot: PilotHotspot) => void;
}) {
  return (
    <View style={styles.insufficientBox}>
      <Text style={styles.insufficientBadgeText}>INSUFFICIENT COMPARABLE EVIDENCE</Text>
      <Text style={styles.insufficientHeading}>
        Only {data.comparableRecordsFound || 0} comparable records found within 1,000m (Minimum{' '}
        {data.minimumRequiredRecords || 3} required).
      </Text>
      <Text style={styles.insufficientDesc}>{data.message}</Text>

      {data.recommendations && data.recommendations.length > 0 && (
        <View style={styles.recommendationsContainer}>
          <Text style={styles.recommendationsHeading}>Recommended Action:</Text>
          {data.recommendations.map((rec, i) => (
            <Text key={i} style={styles.recommendationBullet}>
              • {rec}
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.pilotJumpLabel}>Explore pilot hubs with verified records:</Text>
      <View style={styles.pilotJumpRow}>
        <TouchableOpacity
          style={styles.pilotJumpBtn}
          onPress={() => onSelectLocality(PILOT_HOTSPOTS[0])}
        >
          <Text style={styles.pilotJumpBtnText}>Kannampalayam (5)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.pilotJumpBtn}
          onPress={() => onSelectLocality(PILOT_HOTSPOTS[1])}
        >
          <Text style={styles.pilotJumpBtnText}>Sulur Town (4)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.pilotJumpBtn}
          onPress={() => onSelectLocality(PILOT_HOTSPOTS[2])}
        >
          <Text style={styles.pilotJumpBtnText}>Saravanampatti (4)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =========================================================================
// Root Export wrapped with SafeErrorBoundary
// =========================================================================
export default function App() {
  return (
    <SafeErrorBoundary>
      <GreenartMobileApp />
    </SafeErrorBoundary>
  );
}

// =========================================================================
// Stylesheet
// =========================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorHeader: {
    fontSize: 20,
    fontWeight: '800',
    color: '#dc2626',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#1b5e20',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  header: {
    backgroundColor: '#1b5e20',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#166534',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  brandSubtitle: {
    color: '#bbf7d0',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  pilotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14532d',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  pilotBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    padding: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
    marginBottom: 12,
    lineHeight: 17,
  },
  hotspotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  hotspotBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: '48%',
    marginRight: '2%',
    marginBottom: 8,
  },
  hotspotBtnActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#16a34a',
    borderWidth: 1.5,
  },
  hotspotBtnName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  hotspotBtnNameActive: {
    color: '#15803d',
  },
  hotspotBtnSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  hotspotBtnSubActive: {
    color: '#166534',
    fontWeight: '500',
  },
  mapCanvasBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
    marginBottom: 12,
  },
  mapCanvasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#e2e8f0',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  mapCanvasTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1b5e20',
  },
  mapCanvasRadius: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  mapCanvas: {
    height: 190,
    backgroundColor: '#f1f5f9',
    position: 'relative',
    overflow: 'hidden',
  },
  gridLineH: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  gridLineV: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#e2e8f0',
  },
  mapHotspotPin: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -40 }, { translateY: -12 }],
    zIndex: 10,
  },
  mapHotspotPinSelected: {
    zIndex: 20,
  },
  bufferCircle: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1.5,
    borderColor: '#16a34a',
    top: -38,
    left: -5,
  },
  pinPoint: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#64748b',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  pinPointActive: {
    backgroundColor: '#1b5e20',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderColor: '#ffffff',
  },
  mapPinLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  mapPinLabelActive: {
    color: '#15803d',
    fontWeight: '800',
    borderColor: '#86efac',
    borderWidth: 1,
  },
  compassBox: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  compassText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  mapCanvasFooter: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 11,
    color: '#475569',
    backgroundColor: '#f8fafc',
    textAlign: 'center',
    fontWeight: '500',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  coordBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  coordInputGroup: {
    flex: 1,
    marginRight: 8,
  },
  coordInputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  coordInputField: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  calculateBtn: {
    backgroundColor: '#1b5e20',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  calculateBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  usageContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  usageHeading: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  usageRow: {
    flexDirection: 'row',
  },
  usageChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 6,
  },
  usageChipActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  usageChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  usageChipTextActive: {
    color: '#15803d',
    fontWeight: '700',
  },
  apiErrorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  apiErrorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991b1b',
  },
  apiErrorText: {
    fontSize: 12,
    color: '#b91c1c',
    marginTop: 2,
  },
  loadingBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  loadingMessage: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 14,
  },
  resultHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  resultBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.8,
  },
  confidenceMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  unitToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    padding: 2,
  },
  unitToggleBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  unitToggleBtnActive: {
    backgroundColor: '#1b5e20',
  },
  unitToggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  unitToggleBtnTextActive: {
    color: '#ffffff',
  },
  mainRateHero: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#86efac',
    marginBottom: 12,
  },
  mainRateHeroValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#14532d',
    letterSpacing: -0.5,
  },
  mainRateHeroUnit: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '600',
    marginTop: 2,
  },
  iqrSpreadBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  iqrSpreadHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  iqrSpreadNumbers: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  iqrSpreadFooter: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  evidenceContainer: {
    marginBottom: 12,
  },
  evidenceTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  evidencePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  evidencePill: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 6,
    marginBottom: 6,
  },
  evidencePillText: {
    fontSize: 11,
    color: '#334155',
  },
  guidelineCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 12,
  },
  guidelineCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  guidelineBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400e',
    letterSpacing: 0.5,
  },
  guidelineLocalityName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b45309',
  },
  guidelineRateText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#78350f',
  },
  guidelineNoticeText: {
    fontSize: 10,
    color: '#92400e',
    marginTop: 4,
    lineHeight: 14,
  },
  statutoryDisclaimer: {
    fontSize: 10,
    color: '#94a3b8',
    lineHeight: 14,
    fontStyle: 'italic',
  },
  insufficientBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fcd34d',
    marginBottom: 14,
  },
  insufficientBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  insufficientHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#78350f',
    marginBottom: 4,
  },
  insufficientDesc: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 17,
    marginBottom: 10,
  },
  recommendationsContainer: {
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  recommendationsHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 4,
  },
  recommendationBullet: {
    fontSize: 11,
    color: '#78350f',
    lineHeight: 16,
  },
  pilotJumpLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78350f',
    marginBottom: 6,
  },
  pilotJumpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pilotJumpBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d97706',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 6,
    marginBottom: 6,
  },
  pilotJumpBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  methodologyCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  methodologyHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  methodologyText: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
    marginBottom: 4,
  },
  boldSpan: {
    fontWeight: '600',
    color: '#334155',
  },
});
