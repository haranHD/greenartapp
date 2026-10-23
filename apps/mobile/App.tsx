import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
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
  Image,
  Platform,
  BackHandler,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  mobileApi,
  EstimateApiResponse,
  EstimateSuccessResponse,
  EstimateInsufficientDataResponse,
  LandRecordDto,
  LocalityReference,
  HealthStatusResponse,
} from './src/services/api';

// =========================================================================
// Error Boundary (Guarantees zero white screens under any circumstances)
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
// Helpers & Types
// =========================================================================
type MobileTab = 'home' | 'estimate' | 'records' | 'guideline';
type EstimateStep = 'selection' | 'result';

const LAND_USAGES = [
  { id: 1, label: 'Residential' },
  { id: 2, label: 'Commercial' },
  { id: 3, label: 'Agricultural' },
  { id: 5, label: 'Industrial' },
  { id: 6, label: 'Mixed-Use' },
];

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

const formatLakhs = (val?: number): string => {
  if (val === undefined || val === null || isNaN(val)) return '—';
  if (val >= 100000) {
    const lakhs = val / 100000;
    return `₹${lakhs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
  }
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
};

// =========================================================================
// Enterprise Stroke-Based Tab Icons (Zero Emojis, 100% Vector Geometry)
// =========================================================================
const TabIconHome = ({ active }: { active: boolean }) => {
  const color = active ? '#240046' : '#64748b';
  return (
    <View style={tabIconStyles.iconBox}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 8,
          borderRightWidth: 8,
          borderBottomWidth: 7,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        }}
      />
      <View
        style={{
          width: 12,
          height: 8,
          borderWidth: 1.5,
          borderTopWidth: 0,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <View style={{ width: 4, height: 4, backgroundColor: color }} />
      </View>
    </View>
  );
};

const TabIconEstimate = ({ active }: { active: boolean }) => {
  const color = active ? '#240046' : '#64748b';
  return (
    <View style={tabIconStyles.iconBox}>
      <View
        style={{
          width: 17,
          height: 17,
          borderRadius: 8.5,
          borderWidth: 1.5,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: color }} />
      </View>
    </View>
  );
};

const TabIconNearby = ({ active }: { active: boolean }) => {
  const color = active ? '#240046' : '#64748b';
  return (
    <View style={[tabIconStyles.iconBox, { gap: 2.5 }]}>
      <View style={{ width: 15, height: 1.8, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 15, height: 1.8, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 15, height: 1.8, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
};

const TabIconGuideline = ({ active }: { active: boolean }) => {
  const color = active ? '#240046' : '#64748b';
  return (
    <View style={tabIconStyles.iconBox}>
      <View style={{ width: 16, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ flexDirection: 'row', width: 16, justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 1 }}>
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: 1.5, height: 4.5, backgroundColor: color }} />
          <View style={{ width: 5.5, height: 2.5, borderBottomLeftRadius: 2.5, borderBottomRightRadius: 2.5, backgroundColor: color }} />
        </View>
        <View style={{ width: 1.8, height: 9, backgroundColor: color }} />
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: 1.5, height: 4.5, backgroundColor: color }} />
          <View style={{ width: 5.5, height: 2.5, borderBottomLeftRadius: 2.5, borderBottomRightRadius: 2.5, backgroundColor: color }} />
        </View>
      </View>
      <View style={{ width: 10, height: 1.8, backgroundColor: color, borderRadius: 1, marginTop: -1 }} />
    </View>
  );
};

const tabIconStyles = StyleSheet.create({
  iconBox: {
    width: 20,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});

// =========================================================================
// Main Application Component
// =========================================================================
function GreenartMobileApp() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [estimateStep, setEstimateStep] = useState<EstimateStep>('selection');

  // Android Hardware Back Button Handling
  useEffect(() => {
    const onBackPress = () => {
      if (activeTab === 'estimate' && estimateStep === 'result') {
        setEstimateStep('selection');
        return true;
      }
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [activeTab, estimateStep]);

  // Selected Target Location & Zoning
  const [targetLat, setTargetLat] = useState<number>(11.0012);
  const [targetLng, setTargetLng] = useState<number>(77.0874);
  const [activeLocality, setActiveLocality] = useState<string>('Kannampalayam');
  const [landUsage, setLandUsage] = useState<number>(1);
  const [displayUnit, setDisplayUnit] = useState<'Cent' | 'SqFt'>('Cent');

  // Advanced Coordinates & Search State
  const [showAdvancedCoords, setShowAdvancedCoords] = useState<boolean>(false);
  const [latInput, setLatInput] = useState<string>('11.0012');
  const [lngInput, setLngInput] = useState<string>('77.0874');
  const [homeSearchQuery, setHomeSearchQuery] = useState<string>('');
  const [locationSearchQuery, setLocationSearchQuery] = useState<string>('');
  const [showLocationSuggestions, setShowLocationSuggestions] = useState<boolean>(false);

  // Map Navigation & Zoom
  const [mapZoom, setMapZoom] = useState<number>(15);

  // Valuation State
  const [loadingEstimate, setLoadingEstimate] = useState<boolean>(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<EstimateApiResponse | null>(null);

  // Backend Data State
  const [records, setRecords] = useState<LandRecordDto[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);
  const [localities, setLocalities] = useState<LocalityReference[]>([]);
  const [loadingLocalities, setLoadingLocalities] = useState<boolean>(false);
  const [backendHealth, setBackendHealth] = useState<HealthStatusResponse | null>(null);

  // Records Filtering
  const [filterRecordSource, setFilterRecordSource] = useState<string>('All');
  const [recordsRadiusScope, setRecordsRadiusScope] = useState<'within1km' | 'all'>('within1km');

  // DOM ref for Leaflet on Web
  const webMapContainerRef = useRef<any>(null);
  const webMapInstanceRef = useRef<any>(null);

  // 1. Initial Data Fetching from Real Backend
  useEffect(() => {
    const initData = async () => {
      try {
        const health = await mobileApi.getHealth();
        setBackendHealth(health);
      } catch {
        setBackendHealth({ status: 'Offline' });
      }

      setLoadingLocalities(true);
      try {
        const locs = await mobileApi.getLocalities();
        setLocalities(locs);
      } catch (err) {
        console.warn('Failed to fetch localities:', err);
      } finally {
        setLoadingLocalities(false);
      }

      setLoadingRecords(true);
      try {
        const recs = await mobileApi.getLandRecords();
        setRecords(recs);
      } catch (err) {
        console.warn('Failed to fetch land records:', err);
      } finally {
        setLoadingRecords(false);
      }
    };

    initData();
  }, []);

  // 2. Leaflet Map Web Setup
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Load Leaflet dynamically on Web
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-js') && !(window as any).L) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      document.head.appendChild(script);
    }
  }, []);

  // Synchronize Leaflet map when visible in 'estimate' tab (selection step)
  useEffect(() => {
    if (activeTab !== 'estimate' || estimateStep !== 'selection') return;
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const interval = setInterval(() => {
      const L = (window as any).L;
      if (!L || !webMapContainerRef.current) return;

      clearInterval(interval);
      try {
        if (!webMapInstanceRef.current) {
          webMapInstanceRef.current = L.map(webMapContainerRef.current).setView([targetLat, targetLng], mapZoom);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors & Greenart Properties',
            maxZoom: 19,
          }).addTo(webMapInstanceRef.current);

          webMapInstanceRef.current.on('click', (e: any) => {
            const lat = Math.round(e.latlng.lat * 10000) / 10000;
            const lng = Math.round(e.latlng.lng * 10000) / 10000;
            handleSelectCoordinates(lat, lng, 'Map Pin');
          });
        } else {
          webMapInstanceRef.current.setView([targetLat, targetLng], mapZoom);
          webMapInstanceRef.current.eachLayer((layer: any) => {
            if (layer instanceof L.Marker || layer instanceof L.Circle) {
              webMapInstanceRef.current.removeLayer(layer);
            }
          });
        }

        const map = webMapInstanceRef.current;
        setTimeout(() => map.invalidateSize(), 100);

        // Center Pin
        const targetIcon = L.divIcon({
          className: 'target-pin-icon',
          html: `<div style="background:#240046;color:#ffffff;border:2px solid #d4af37;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;box-shadow:0 2px 6px rgba(0,0,0,0.3);">PIN</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        L.marker([targetLat, targetLng], { icon: targetIcon, title: activeLocality }).addTo(map);

        // 1,000m Buffer Circle
        L.circle([targetLat, targetLng], {
          radius: 1000,
          color: '#d4af37',
          fillColor: '#d4af37',
          fillOpacity: 0.1,
          weight: 1.5,
        }).addTo(map);

        // Nearby records
        records.forEach((r) => {
          let dotColor = '#16a34a';
          if (r.sourceCategory === 'GovernmentGuideline') dotColor = '#2563eb';
          else if (r.sourceCategory === 'AdvertisedAskingPrice') dotColor = '#ea580c';
          else if (r.sourceCategory === 'ClientResearch') dotColor = '#7e22ce';

          const dotIcon = L.divIcon({
            className: 'rec-dot-icon',
            html: `<div style="background:${dotColor};border:1.5px solid #ffffff;border-radius:50%;width:10px;height:10px;"></div>`,
            iconSize: [10, 10],
            iconAnchor: [5, 5],
          });
          L.marker([r.latitude, r.longitude], { icon: dotIcon }).addTo(map);
        });
      } catch (err) {
        console.warn('Leaflet initialization error:', err);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [activeTab, estimateStep, targetLat, targetLng, mapZoom, activeLocality, records]);

  // 3. Selection Handlers
  const handleSelectCoordinates = (lat: number, lng: number, localityName: string) => {
    setTargetLat(lat);
    setTargetLng(lng);
    setLatInput(lat.toFixed(4));
    setLngInput(lng.toFixed(4));
    setActiveLocality(localityName);
    setLocationSearchQuery(localityName === 'Map Pin' || localityName === 'Custom Coordinates' ? '' : localityName);
    setShowLocationSuggestions(false);
  };

  const handleSelectLocalityRef = (loc: LocalityReference) => {
    handleSelectCoordinates(loc.latitude, loc.longitude, loc.name);
  };

  const handleManualCoordSubmit = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng)) {
      setEstimateError('Please enter valid numeric latitude and longitude coordinates.');
      return;
    }
    handleSelectCoordinates(lat, lng, 'Custom Coordinates');
    executeCalculation(lat, lng, landUsage);
  };

  // 4. Calculate Estimate Action
  const executeCalculation = async (lat: number = targetLat, lng: number = targetLng, usage: number = landUsage) => {
    setLoadingEstimate(true);
    setEstimateError(null);
    setEstimateStep('result');
    setActiveTab('estimate');

    try {
      const res = await mobileApi.calculateEstimate(lat, lng, usage, 1000);
      setEstimate(res);
    } catch (err: any) {
      setEstimateError(err.message || 'Unable to calculate estimate from backend.');
      setEstimate(null);
    } finally {
      setLoadingEstimate(false);
    }
  };

  // Search Submission (Supports Locality Names and Raw Coordinates "lat, lng")
  const handleSearchSubmit = (query: string, navigateToEstimate: boolean = false) => {
    if (!query.trim()) return;
    const coordMatch = query.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[3]);
      if (lat >= 8.0 && lat <= 14.0 && lng >= 76.0 && lng <= 81.0) {
        handleSelectCoordinates(lat, lng, 'Custom Coordinates');
        if (navigateToEstimate) {
          setActiveTab('estimate');
          setEstimateStep('selection');
        }
        return;
      }
    }

    const match = localities.find(
      (l) => l.name.toLowerCase() === query.trim().toLowerCase() ||
        l.name.toLowerCase().includes(query.trim().toLowerCase())
    );
    if (match) {
      handleSelectLocalityRef(match);
      if (navigateToEstimate) {
        setActiveTab('estimate');
        setEstimateStep('selection');
      }
    }
  };

  // Autocomplete Suggestions for Search
  const filteredSuggestions = localities.filter((loc) => {
    const q = (locationSearchQuery || homeSearchQuery).toLowerCase().trim();
    if (!q) return false;
    return loc.name.toLowerCase().includes(q) || loc.district.toLowerCase().includes(q);
  });

  // Distance sorted comparables for Tab 3 (Nearby Records)
  const comparablesList = records
    .filter((r) => {
      if (r.verificationStatus === 'Rejected' || r.verificationStatus === 'Archived') return false;
      if (filterRecordSource === 'All') return true;
      return r.sourceCategory === filterRecordSource;
    })
    .map((r) => {
      const dist = calculateDistanceMeters(targetLat, targetLng, r.latitude, r.longitude);
      return { ...r, distanceMeters: dist };
    })
    .filter((r) => {
      if (recordsRadiusScope === 'within1km') return r.distanceMeters <= 1000;
      return true;
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const eligibleWithin1kmCount = records.filter(
    (r) =>
      r.verificationStatus !== 'Rejected' &&
      r.verificationStatus !== 'Archived' &&
      calculateDistanceMeters(targetLat, targetLng, r.latitude, r.longitude) <= 1000
  ).length;

  const currentUsageObj = LAND_USAGES.find((u) => u.id === landUsage) || LAND_USAGES[0];

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Math.max(insets.top, 0) }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a0033" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* =========================================================================
            TOP APP HEADER
            ========================================================================= */}
        <View style={styles.topHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.brandBadge}>
              <Image
                source={require('./assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.onlineStatusPill}>
              <View
                style={[
                  styles.statusDot,
                  backendHealth?.status === 'Healthy' || !estimateError
                    ? styles.statusDotGreen
                    : styles.statusDotAmber,
                ]}
              />
              <Text style={styles.onlineStatusText}>
                {backendHealth?.status === 'Healthy' || !estimateError ? 'Live Data' : 'Checking'}
              </Text>
            </View>
          </View>
        </View>

        {/* =========================================================================
            SCREEN BODY (BASED ON ACTIVE TAB)
            ========================================================================= */}
        <View style={styles.screenContainer}>
          {/* =====================================================================
              SCREEN A: HOME
              ===================================================================== */}
          {activeTab === 'home' && (
            <ScrollView
              contentContainerStyle={[styles.scrollBody, { paddingBottom: 80 + insets.bottom }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Hero Banner */}
              <View style={styles.homeHeroCard}>
                <Text style={styles.homeHeroTag}>Tamil Nadu Land Intelligence</Text>
                <Text style={styles.homeHeroTitle}>Institutional Property Valuation</Text>
                <Text style={styles.homeHeroSub}>
                  Evidence-based land market valuations calculated from registered transactions within a 1,000-metre radius.
                </Text>

                <TouchableOpacity
                  style={styles.primaryHeroBtn}
                  onPress={() => {
                    setActiveTab('estimate');
                    setEstimateStep('selection');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryHeroBtnText}>Start Property Valuation</Text>
                </TouchableOpacity>
              </View>

              {/* Real Search Bar */}
              <View style={styles.homeSearchCard}>
                <Text style={styles.sectionHeaderTitle}>Search Locality or District</Text>
                <View style={styles.searchBarBox}>
                  <TextInput
                    style={styles.searchBarInput}
                    placeholder="Search locality, taluk, or coordinates..."
                    placeholderTextColor="#94a3b8"
                    value={homeSearchQuery}
                    onChangeText={setHomeSearchQuery}
                    returnKeyType="search"
                    onSubmitEditing={() => {
                      handleSearchSubmit(homeSearchQuery, true);
                      setHomeSearchQuery('');
                    }}
                  />
                  {homeSearchQuery ? (
                    <TouchableOpacity onPress={() => setHomeSearchQuery('')} style={{ padding: 4 }}>
                      <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '700' }}>✕</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Real Search Suggestions Dropdown */}
                {homeSearchQuery.trim() !== '' && (
                  <View style={styles.suggestionsContainer}>
                    {filteredSuggestions.length === 0 ? (
                      <Text style={styles.noSuggestionsText}>No matching localities found.</Text>
                    ) : (
                      filteredSuggestions.map((loc) => (
                        <TouchableOpacity
                          key={loc.name}
                          style={styles.suggestionRow}
                          onPress={() => {
                            handleSelectLocalityRef(loc);
                            setHomeSearchQuery('');
                            setActiveTab('estimate');
                            setEstimateStep('selection');
                          }}
                        >
                          <View>
                            <Text style={styles.suggestionName}>{loc.name}</Text>
                            <Text style={styles.suggestionDistrict}>{loc.district}</Text>
                          </View>
                          <View style={styles.suggestionCountBadge}>
                            <Text style={styles.suggestionCountText}>{loc.recordCount} Records</Text>
                          </View>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>

              {/* How It Works Section */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeaderTitle}>How the Valuation Engine Works</Text>
                <Text style={styles.sectionHeaderDesc}>
                  Objective principles governing evidence-based property rate calculations:
                </Text>

                <View style={styles.workflowStepItem}>
                  <View style={styles.stepNumberBadge}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>1,000m Geodesic Search</Text>
                    <Text style={styles.stepDesc}>
                      Evaluates comparable market transactions strictly within a 1 km radius of the target coordinates.
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
                      Calculates statistical median and 25th–75th percentile bands, rejecting extreme speculative asking prices.
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
                      Government guideline rates from TNREGINET are maintained strictly as reference benchmarks and never blended into market sales.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Active Corridors from Backend */}
              <View style={styles.sectionCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionHeaderTitle}>Active Pilot Corridors</Text>
                  <Text style={styles.badgeSubtle}>{localities.length} Corridors</Text>
                </View>
                <Text style={styles.sectionHeaderDesc}>
                  Reference localities with verified transaction records:
                </Text>

                {loadingLocalities ? (
                  <ActivityIndicator color="#240046" style={{ marginVertical: 12 }} />
                ) : (
                  <View style={styles.hotspotGrid}>
                    {localities.map((loc) => (
                      <TouchableOpacity
                        key={loc.name}
                        style={[
                          styles.hotspotCard,
                          activeLocality === loc.name && styles.hotspotCardActive,
                        ]}
                        onPress={() => {
                          handleSelectLocalityRef(loc);
                          setActiveTab('estimate');
                          setEstimateStep('selection');
                        }}
                        activeOpacity={0.75}
                      >
                        <View style={styles.hotspotTop}>
                          <Text style={styles.hotspotName}>{loc.name}</Text>
                          <Text style={styles.hotspotBadge}>{loc.recordCount} Records</Text>
                        </View>
                        <Text style={styles.hotspotDistrict}>{loc.district}</Text>
                        <Text style={styles.hotspotRate}>
                          Guideline: ₹{(loc.guidelineRatePerCent / 100000).toFixed(2)}L / Cent
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {/* =====================================================================
            SCREEN B & C: ESTIMATE (LOCATION SELECTION & VALUATION RESULTS)
            ===================================================================== */}
          {activeTab === 'estimate' && (
            <ScrollView
              contentContainerStyle={[styles.scrollBody, { paddingBottom: 80 + insets.bottom }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* STEP 1: LOCATION SELECTION */}
              {estimateStep === 'selection' ? (
                <View>
                  {/* Search & Selection Header */}
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Select Target Location</Text>
                    <Text style={styles.cardSubtitle}>
                      Search Tamil Nadu locality or tap on map to position pin
                    </Text>

                    {/* Searchable Location Input */}
                    <View style={styles.searchBarBox}>
                      <TextInput
                        style={styles.searchBarInput}
                        placeholder="Search locality, taluk, or coordinates..."
                        placeholderTextColor="#94a3b8"
                        value={locationSearchQuery}
                        onChangeText={(text: string) => {
                          setLocationSearchQuery(text);
                          setShowLocationSuggestions(true);
                        }}
                        onFocus={() => setShowLocationSuggestions(true)}
                        returnKeyType="search"
                        onSubmitEditing={() => {
                          handleSearchSubmit(locationSearchQuery, false);
                          setShowLocationSuggestions(false);
                        }}
                      />
                      {locationSearchQuery ? (
                        <TouchableOpacity
                          onPress={() => {
                            setLocationSearchQuery('');
                            setShowLocationSuggestions(false);
                          }}
                          style={{ padding: 4 }}
                        >
                          <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '700' }}>✕</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {/* Location Autocomplete Dropdown */}
                    {showLocationSuggestions && filteredSuggestions.length > 0 && (
                      <View style={styles.suggestionsContainer}>
                        {filteredSuggestions.map((loc) => (
                          <TouchableOpacity
                            key={loc.name}
                            style={styles.suggestionRow}
                            onPress={() => handleSelectLocalityRef(loc)}
                          >
                            <View>
                              <Text style={styles.suggestionName}>{loc.name}</Text>
                              <Text style={styles.suggestionDistrict}>{loc.district}</Text>
                            </View>
                            <View style={styles.suggestionCountBadge}>
                              <Text style={styles.suggestionCountText}>{loc.recordCount} Records</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Quick Select Locality Chips */}
                    <View style={styles.quickChipsRow}>
                      <Text style={styles.quickChipsLabel}>Quick jump:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        {localities.slice(0, 4).map((loc) => (
                          <TouchableOpacity
                            key={loc.name}
                            style={[
                              styles.quickChipBtn,
                              activeLocality === loc.name && styles.quickChipBtnActive,
                            ]}
                            onPress={() => handleSelectLocalityRef(loc)}
                          >
                            <Text
                              style={[
                                styles.quickChipText,
                                activeLocality === loc.name && styles.quickChipTextActive,
                              ]}
                            >
                              {loc.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>

                  {/* Interactive Map Card (Expanded Space & Working Controls) */}
                  <View style={styles.mapCard}>
                    <View style={styles.mapCardHeader}>
                      <View>
                        <Text style={styles.mapCardTitle}>Interactive Map</Text>
                        <Text style={styles.mapCardSubtitle}>
                          {activeLocality} • 1,000m Buffer
                        </Text>
                      </View>
                      <View style={styles.mapZoomControls}>
                        <TouchableOpacity
                          style={styles.zoomBtn}
                          onPress={() => setMapZoom((z) => Math.min(z + 1, 18))}
                        >
                          <Text style={styles.zoomBtnText}>+</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.zoomBtn}
                          onPress={() => setMapZoom((z) => Math.max(z - 1, 12))}
                        >
                          <Text style={styles.zoomBtnText}>−</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Map Viewport Canvas */}
                    {Platform.OS === 'web' ? (
                      <View ref={webMapContainerRef} style={styles.leafletCanvas} />
                    ) : (
                      <View style={styles.nativeMapCanvas}>
                        <View style={styles.canvasBufferCircle} />
                        <View style={styles.canvasPinPoint}>
                          <View style={styles.canvasPinInner} />
                        </View>
                        <Text style={styles.canvasPinText}>{activeLocality}</Text>
                      </View>
                    )}

                    <View style={styles.mapFooterBar}>
                      <Text style={styles.mapFooterCoord}>
                        {targetLat.toFixed(4)}° N, {targetLng.toFixed(4)}° E
                      </Text>
                      <Text style={styles.mapFooterRadius}>Radius: 1,000m</Text>
                    </View>
                  </View>

                  {/* Land Classification Selector */}
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Zoning Classification</Text>
                    <Text style={styles.cardSubtitle}>Select land usage classification:</Text>

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

                    {/* Collapsible Advanced Coordinates Drawer */}
                    <TouchableOpacity
                      style={styles.advancedDrawerToggle}
                      onPress={() => setShowAdvancedCoords(!showAdvancedCoords)}
                    >
                      <Text style={styles.advancedDrawerText}>
                        {showAdvancedCoords ? '▲ Hide Exact Coordinates' : '▼ Advanced: Enter Exact Coordinates'}
                      </Text>
                    </TouchableOpacity>

                    {showAdvancedCoords && (
                      <View style={styles.advancedCoordBox}>
                        <View style={styles.coordInputRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.coordLabel}>Latitude</Text>
                            <TextInput
                              style={styles.coordTextInput}
                              value={latInput}
                              onChangeText={setLatInput}
                              keyboardType="numeric"
                              placeholder="11.0012"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.coordLabel}>Longitude</Text>
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
                  </View>

                  {/* Primary Action Button */}
                  <TouchableOpacity
                    style={styles.calculateCtaBtn}
                    onPress={() => executeCalculation(targetLat, targetLng, landUsage)}
                    activeOpacity={0.85}
                    disabled={loadingEstimate}
                  >
                    {loadingEstimate ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.calculateCtaText}>Calculate Market Estimate</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                /* STEP 2: VALUATION RESULTS */
                <View>
                  {/* Back to Location Selection Bar */}
                  <View style={styles.resultsNavBar}>
                    <TouchableOpacity
                      style={styles.changeLocBtn}
                      onPress={() => setEstimateStep('selection')}
                    >
                      <Text style={styles.changeLocBtnText}>← Change Location</Text>
                    </TouchableOpacity>
                    <Text style={styles.resultsNavTitle} numberOfLines={1}>
                      {activeLocality} • {currentUsageObj.label}
                    </Text>
                  </View>

                  {/* Loading State */}
                  {loadingEstimate && (
                    <View style={styles.loadingCard}>
                      <ActivityIndicator size="small" color="#240046" />
                      <Text style={styles.loadingCardTitle}>Calculating Valuation...</Text>
                      <Text style={styles.loadingCardSub}>
                        Searching verified comparable records within 1,000 metres.
                      </Text>
                    </View>
                  )}

                  {/* Error Banner */}
                  {estimateError && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorBoxTitle}>Valuation Request Notice</Text>
                      <Text style={styles.errorBoxText}>{estimateError}</Text>
                      <TouchableOpacity
                        style={styles.retryBtnSmall}
                        onPress={() => executeCalculation(targetLat, targetLng, landUsage)}
                      >
                        <Text style={styles.retryBtnSmallText}>Retry Calculation</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Result State: Success */}
                  {!loadingEstimate && estimate && estimate.status === 'Success' && (
                    <View>
                      {/* Primary Market Estimate Card */}
                      <View style={styles.estimateHeroCard}>
                        <View style={styles.cardHeaderRow}>
                          <View>
                            <Text style={styles.estimateHeroLabel}>Estimated Market Value</Text>
                            <Text style={styles.estimateHeroEvidence}>
                              {estimate.comparableRecordCount} {estimate.comparableRecordCount === 1 ? 'record' : 'records'} within 1,000m
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.confidencePill,
                              estimate.confidence === 'High'
                                ? styles.confidenceHigh
                                : estimate.confidence === 'Moderate'
                                  ? styles.confidenceMod
                                  : styles.confidenceLow,
                            ]}
                          >
                            <Text
                              style={[
                                styles.confidencePillText,
                                estimate.confidence === 'High'
                                  ? styles.confidenceHighText
                                  : estimate.confidence === 'Moderate'
                                    ? styles.confidenceModText
                                    : styles.confidenceLowText,
                              ]}
                            >
                              {estimate.confidence} Confidence
                            </Text>
                          </View>
                        </View>

                        {/* Primary Rate & Unit Toggle */}
                        <View style={styles.heroRateRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.heroPricePrimary}>
                              {displayUnit === 'Cent'
                                ? `₹${(estimate.priceRangePerCent.medianRate / 100000).toFixed(2)} Lakhs`
                                : `₹${estimate.priceRangePerSqFt.medianRate.toLocaleString('en-IN')}`}
                              <Text style={styles.heroPriceUnit}> / {displayUnit}</Text>
                            </Text>
                            <Text style={styles.heroPriceSecondary}>
                              {displayUnit === 'Cent'
                                ? `₹${estimate.priceRangePerSqFt.medianRate.toLocaleString('en-IN')} / Sq.Ft`
                                : `₹${(estimate.priceRangePerCent.medianRate / 100000).toFixed(2)} Lakhs / Cent`}
                            </Text>
                          </View>

                          {/* Unit Switcher */}
                          <View style={styles.unitTogglePill}>
                            <TouchableOpacity
                              style={[styles.unitToggleOption, displayUnit === 'Cent' && styles.unitToggleOptionActive]}
                              onPress={() => setDisplayUnit('Cent')}
                            >
                              <Text style={[styles.unitToggleText, displayUnit === 'Cent' && styles.unitToggleTextActive]}>
                                Cent
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.unitToggleOption, displayUnit === 'SqFt' && styles.unitToggleOptionActive]}
                              onPress={() => setDisplayUnit('SqFt')}
                            >
                              <Text style={[styles.unitToggleText, displayUnit === 'SqFt' && styles.unitToggleTextActive]}>
                                Sq.Ft
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Statistical Bands */}
                        <View style={styles.statsGrid}>
                          <View style={styles.statBox}>
                            <Text style={styles.statBoxLabel}>Typical Range (25th–75th)</Text>
                            <Text style={styles.statBoxValue}>
                              {displayUnit === 'Cent'
                                ? `₹${(estimate.priceRangePerCent.percentile25 / 100000).toFixed(2)}L – ₹${(estimate.priceRangePerCent.percentile75 / 100000).toFixed(2)}L`
                                : `₹${estimate.priceRangePerSqFt.percentile25} – ₹${estimate.priceRangePerSqFt.percentile75}`}
                            </Text>
                            <Text style={styles.statBoxSub}>
                              {displayUnit === 'Cent'
                                ? `₹${estimate.priceRangePerSqFt.percentile25} – ₹${estimate.priceRangePerSqFt.percentile75} / sq.ft`
                                : `₹${(estimate.priceRangePerCent.percentile25 / 100000).toFixed(2)}L – ₹${(estimate.priceRangePerCent.percentile75 / 100000).toFixed(2)}L / cent`}
                            </Text>
                          </View>

                          <View style={styles.statBox}>
                            <Text style={styles.statBoxLabel}>Observed Range (Min–Max)</Text>
                            <Text style={styles.statBoxValue}>
                              {displayUnit === 'Cent'
                                ? `₹${(estimate.priceRangePerCent.minRate / 100000).toFixed(2)}L – ₹${(estimate.priceRangePerCent.maxRate / 100000).toFixed(2)}L`
                                : `₹${estimate.priceRangePerSqFt.minRate} – ₹${estimate.priceRangePerSqFt.maxRate}`}
                            </Text>
                            <Text style={styles.statBoxSub}>
                              {estimate.comparableRecordCount} parcels within 1,000m
                            </Text>
                          </View>
                        </View>

                        {/* Concise Disclaimer */}
                        <Text style={styles.estimateDisclaimer}>
                          Indicative statistical estimate derived from recent 1,000m comparables; not an official legal appraisal or guaranteed sale price.
                        </Text>
                      </View>

                      {/* Government Guideline Benchmark Panel (Separated) */}
                      {estimate.governmentGuidelineReference && (
                        <View style={styles.guidelineCard}>
                          <View style={styles.cardHeaderRow}>
                            <Text style={styles.guidelineCardTitle}>Government Guideline Benchmark</Text>
                            <Text style={styles.statutoryTag}>Statutory</Text>
                          </View>
                          <Text style={styles.guidelineCardRate}>
                            ₹{(estimate.governmentGuidelineReference.guidelineRatePerCent / 100000).toFixed(2)} Lakhs / Cent{' '}
                            <Text style={styles.guidelineCardSub}>
                              (₹{estimate.governmentGuidelineReference.guidelineRatePerSqFt.toLocaleString('en-IN')} / Sq.Ft)
                            </Text>
                          </Text>
                          <Text style={styles.guidelineCardNotice}>
                            TNREGINET statutory minimum valuation benchmark for stamp duty registration; not an open-market transaction value.
                          </Text>
                        </View>
                      )}

                      {/* Next Action Buttons */}
                      <View style={styles.resultActionsRow}>
                        <TouchableOpacity
                          style={styles.viewRecordsBtn}
                          onPress={() => {
                            setRecordsRadiusScope('within1km');
                            setActiveTab('records');
                          }}
                        >
                          <Text style={styles.viewRecordsBtnText}>
                            View Nearby Records ({estimate.comparableRecordCount})
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.adjustLocationBtn}
                          onPress={() => setEstimateStep('selection')}
                        >
                          <Text style={styles.adjustLocationBtnText}>Adjust Location</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Result State: Insufficient Data */}
                  {!loadingEstimate && estimate && estimate.status === 'InsufficientData' && (
                    <View style={styles.insufficientCard}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.insufficientBadge}>Insufficient Data</Text>
                      </View>
                      <Text style={styles.insufficientHeading}>
                        Fewer than 3 Records within 1,000m
                      </Text>
                      <Text style={styles.insufficientBody}>
                        {estimate.message ||
                          `Only ${estimate.comparableRecordsFound || 0} comparable record(s) found within 1,000 metres for ${currentUsageObj.label} land. The valuation engine requires a minimum of 3 transactions to calculate an evidence-based market rate.`}
                      </Text>

                      {/* Guideline fallback if available */}
                      {(() => {
                        const matchingLoc = localities.find(
                          (l) => l.name.toLowerCase() === activeLocality.toLowerCase()
                        );
                        if (matchingLoc && matchingLoc.guidelineRatePerCent > 0) {
                          return (
                            <View style={styles.guidelineCard}>
                              <Text style={styles.guidelineCardTitle}>Statutory Guideline Benchmark</Text>
                              <Text style={styles.guidelineCardRate}>
                                ₹{(matchingLoc.guidelineRatePerCent / 100000).toFixed(2)} Lakhs / Cent
                              </Text>
                              <Text style={styles.guidelineCardNotice}>
                                Statutory benchmark rate for {matchingLoc.name}. Market comparable volume currently below estimation threshold.
                              </Text>
                            </View>
                          );
                        }
                        return null;
                      })()}

                      {estimate.recommendations && estimate.recommendations.length > 0 && (
                        <View style={styles.recommendationsBox}>
                          <Text style={styles.recommendationsTitle}>Recommended Action:</Text>
                          {estimate.recommendations.map((rec, i) => (
                            <Text key={i} style={styles.recommendationItem}>
                              • {rec}
                            </Text>
                          ))}
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.selectDiffLocBtn}
                        onPress={() => setEstimateStep('selection')}
                      >
                        <Text style={styles.selectDiffLocBtnText}>Select Different Location</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          )}

          {/* =====================================================================
            SCREEN D: NEARBY COMPARABLE RECORDS
            ===================================================================== */}
          {activeTab === 'records' && (
            <ScrollView
              contentContainerStyle={[styles.scrollBody, { paddingBottom: 80 + insets.bottom }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Header & Scope Filter */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={styles.cardTitle}>Nearby Records</Text>
                    <Text style={styles.cardSubtitle}>
                      Proximity to {activeLocality} ({targetLat.toFixed(4)}, {targetLng.toFixed(4)})
                    </Text>
                  </View>
                  <Text style={styles.badgeSubtle}>{comparablesList.length} Found</Text>
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
                      Within 1 km ({eligibleWithin1kmCount})
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
                      All Corridors ({records.length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Source Category Filter Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 8 }}>
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

              {/* Records List */}
              {loadingRecords ? (
                <ActivityIndicator color="#240046" style={{ marginVertical: 20 }} />
              ) : comparablesList.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardTitle}>No Records Found</Text>
                  <Text style={styles.emptyCardSub}>
                    No land records match the selected proximity or source category filter.
                  </Text>
                </View>
              ) : (
                comparablesList.map((rec) => {
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
                              ? `${rec.distanceMeters}m away`
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
                            rec.sourceCategory === 'VerifiedTransaction'
                              ? styles.sourceTagGreen
                              : rec.sourceCategory === 'GovernmentGuideline'
                                ? styles.sourceTagBlue
                                : styles.sourceTagAmber,
                          ]}
                        >
                          <Text
                            style={[
                              styles.sourceTagText,
                              rec.sourceCategory === 'VerifiedTransaction'
                                ? styles.sourceTagTextGreen
                                : rec.sourceCategory === 'GovernmentGuideline'
                                  ? styles.sourceTagTextBlue
                                  : styles.sourceTagTextAmber,
                            ]}
                          >
                            {rec.sourceCategory === 'VerifiedTransaction'
                              ? 'Verified Deed'
                              : rec.sourceCategory === 'GovernmentGuideline'
                                ? 'Guideline'
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
          )}

          {/* =====================================================================
            SCREEN E: GUIDELINE & METHODOLOGY
            ===================================================================== */}
          {activeTab === 'guideline' && (
            <ScrollView
              contentContainerStyle={[styles.scrollBody, { paddingBottom: 80 + insets.bottom }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
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
                            <Text style={styles.guidelineHubUnit}>/ Cent</Text>
                          </View>
                        </View>
                        <View style={styles.guidelineHubBottom}>
                          <Text style={styles.guidelineHubSqFt}>
                            ₹{loc.guidelineRatePerSqFt.toLocaleString('en-IN')} / Sq.Ft
                          </Text>
                          <Text style={styles.guidelineHubRecords}>{loc.recordCount} Records</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Consumer Valuation Methodology Principles */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Valuation Methodology</Text>
                <Text style={styles.cardSubtitle}>
                  Core principles governing evidence-based property valuations:
                </Text>

                <View style={styles.principleItem}>
                  <Text style={styles.principleHeader}>1. Coordinate-Specific Valuation</Text>
                  <Text style={styles.principleText}>
                    Valuation calculations operate directly from the target property coordinates selected by the user, independent of mobile device GPS location.
                  </Text>
                </View>

                <View style={styles.principleItem}>
                  <Text style={styles.principleHeader}>2. 1,000-Metre Market Buffer</Text>
                  <Text style={styles.principleText}>
                    The engine surveys comparable parcels strictly within a 1,000-metre geodesic search boundary around the target property.
                  </Text>
                </View>

                <View style={styles.principleItem}>
                  <Text style={styles.principleHeader}>3. Median Valuation & Range</Text>
                  <Text style={styles.principleText}>
                    Aggregations derive the median and 25th–75th percentile typical range, eliminating distortions from extreme speculative asking prices.
                  </Text>
                </View>

                <View style={styles.principleItem}>
                  <Text style={styles.principleHeader}>4. Complete Statutory Separation</Text>
                  <Text style={styles.principleText}>
                    Government Guideline Values are presented as statutory references only and are never averaged into open-market transaction estimates.
                  </Text>
                </View>

                <View style={styles.principleItem}>
                  <Text style={styles.principleHeader}>5. Evidence Threshold</Text>
                  <Text style={styles.principleText}>
                    A minimum of 3 comparable records within 1,000 metres is strictly required before an estimate is generated. If evidence is insufficient, this is transparently reported.
                  </Text>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* =========================================================================
          BOTTOM NAVIGATION BAR (ACCESSIBLE 48PX TOUCH TARGETS, CLEAR LABELS)
          ========================================================================= */}
      <View style={[styles.bottomTabBar, { height: 58 + insets.bottom, paddingBottom: insets.bottom }]}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'home' && styles.tabButtonActive]}
          onPress={() => setActiveTab('home')}
          activeOpacity={0.7}
        >
          <TabIconHome active={activeTab === 'home'} />
          <Text style={[styles.tabButtonText, activeTab === 'home' && styles.tabButtonTextActive]}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'estimate' && styles.tabButtonActive]}
          onPress={() => setActiveTab('estimate')}
          activeOpacity={0.7}
        >
          <TabIconEstimate active={activeTab === 'estimate'} />
          <Text style={[styles.tabButtonText, activeTab === 'estimate' && styles.tabButtonTextActive]}>
            Estimate
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'records' && styles.tabButtonActive]}
          onPress={() => setActiveTab('records')}
          activeOpacity={0.7}
        >
          <TabIconNearby active={activeTab === 'records'} />
          <Text style={[styles.tabButtonText, activeTab === 'records' && styles.tabButtonTextActive]}>
            Nearby
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'guideline' && styles.tabButtonActive]}
          onPress={() => setActiveTab('guideline')}
          activeOpacity={0.7}
        >
          <TabIconGuideline active={activeTab === 'guideline'} />
          <Text style={[styles.tabButtonText, activeTab === 'guideline' && styles.tabButtonTextActive]}>
            Guideline
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// =========================================================================
// Root Export with Error Boundary
// =========================================================================
export default function App() {
  return (
    <SafeErrorBoundary>
      <SafeAreaProvider>
        <GreenartMobileApp />
      </SafeAreaProvider>
    </SafeErrorBoundary>
  );
}

// =========================================================================
// Mobile Stylesheet (Enterprise Restrained Palette)
// =========================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#991b1b',
    marginBottom: 6,
  },
  errorSubtext: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  retryBtn: {
    backgroundColor: '#240046',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 4,
    minHeight: 48,
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Header */
  topHeader: {
    backgroundColor: '#1a0033',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2d124d',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  logoImage: {
    width: 120,
    height: 28,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusDotGreen: {
    backgroundColor: '#22c55e',
  },
  statusDotAmber: {
    backgroundColor: '#f59e0b',
  },
  onlineStatusText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
  },

  /* Screen Layout */
  screenContainer: {
    flex: 1,
  },
  scrollBody: {
    padding: 14,
    paddingBottom: 80,
  },

  /* Home Screen */
  homeHeroCard: {
    backgroundColor: '#240046',
    borderRadius: 6,
    padding: 18,
    marginBottom: 14,
  },
  homeHeroTag: {
    color: '#d4af37',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  homeHeroTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    marginBottom: 8,
  },
  homeHeroSub: {
    color: '#d8cce8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  primaryHeroBtn: {
    backgroundColor: '#d4af37',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryHeroBtnText: {
    color: '#1a0033',
    fontSize: 14,
    fontWeight: '700',
  },

  homeSearchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 14,
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    paddingHorizontal: 10,
    minHeight: 44,
    marginTop: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 8,
  },
  suggestionsContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    marginTop: 6,
    maxHeight: 180,
  },
  suggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  suggestionDistrict: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  suggestionCountBadge: {
    backgroundColor: '#faf5ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  suggestionCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#240046',
  },
  noSuggestionsText: {
    padding: 12,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },

  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionHeaderDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 12,
    lineHeight: 16,
  },

  workflowStepItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#240046',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },

  hotspotGrid: {
    gap: 8,
  },
  hotspotCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 10,
  },
  hotspotCardActive: {
    borderColor: '#240046',
    backgroundColor: '#faf5ff',
  },
  hotspotTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  hotspotName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  hotspotBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#240046',
  },
  hotspotDistrict: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
  },
  hotspotRate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },

  /* Standard Card */
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeSubtle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },

  /* Quick Chips */
  quickChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  quickChipsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  quickChipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    minHeight: 44,
    justifyContent: 'center',
  },
  quickChipBtnActive: {
    backgroundColor: '#240046',
    borderColor: '#240046',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  quickChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  /* Map Card */
  mapCard: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 14,
  },
  mapCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  mapCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  mapCardSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  mapZoomControls: {
    flexDirection: 'row',
    gap: 6,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 18,
  },
  leafletCanvas: {
    height: 280,
    width: '100%',
    backgroundColor: '#e2e8f0',
  },
  nativeMapCanvas: {
    height: 240,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  canvasBufferCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: '#d4af37',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    position: 'absolute',
  },
  canvasPinPoint: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#240046',
    borderWidth: 2,
    borderColor: '#d4af37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasPinInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  canvasPinText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  mapFooterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  mapFooterCoord: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#475569',
  },
  mapFooterRadius: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },

  /* Usage Selector */
  usageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  usageChipBtn: {
    flex: 1,
    minWidth: 80,
    minHeight: 44,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  usageChipBtnActive: {
    backgroundColor: '#240046',
    borderColor: '#240046',
  },
  usageChipBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  usageChipBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  /* Advanced Coordinates Drawer */
  advancedDrawerToggle: {
    paddingVertical: 6,
    marginTop: 4,
  },
  advancedDrawerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#581c87',
  },
  advancedCoordBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 10,
    marginTop: 6,
  },
  coordInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  coordLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  coordTextInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0f172a',
  },
  applyCoordBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#240046',
    borderRadius: 3,
    alignItems: 'center',
    paddingVertical: 6,
  },
  applyCoordBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#240046',
  },

  /* Primary CTA */
  calculateCtaBtn: {
    backgroundColor: '#240046',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginBottom: 14,
  },
  calculateCtaText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Results Screen */
  resultsNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  changeLocBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  changeLocBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#240046',
  },
  resultsNavTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },

  loadingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
  },
  loadingCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 8,
  },
  loadingCardSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },

  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 4,
    padding: 12,
    marginBottom: 14,
  },
  errorBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991b1b',
  },
  errorBoxText: {
    fontSize: 12,
    color: '#7f1d1d',
    marginTop: 2,
    marginBottom: 8,
  },
  retryBtnSmall: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#991b1b',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  retryBtnSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991b1b',
  },

  /* Estimate Hero Card */
  estimateHeroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderTopWidth: 3,
    borderTopColor: '#d4af37',
    padding: 16,
    marginBottom: 14,
  },
  estimateHeroLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#64748b',
  },
  estimateHeroEvidence: {
    fontSize: 12,
    color: '#334155',
    marginTop: 1,
  },
  confidencePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
  },
  confidenceHigh: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  confidenceHighText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
  },
  confidenceMod: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  confidenceModText: {
    color: '#1e40af',
    fontSize: 11,
    fontWeight: '700',
  },
  confidenceLow: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  confidenceLowText: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '700',
  },
  confidencePillText: {},

  heroRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginVertical: 12,
  },
  heroPricePrimary: {
    fontSize: 22,
    fontWeight: '800',
    color: '#240046',
  },
  heroPriceUnit: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  heroPriceSecondary: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  unitTogglePill: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    padding: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 44,
    alignItems: 'center',
  },
  unitToggleOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 3,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitToggleOptionActive: {
    backgroundColor: '#ffffff',
  },
  unitToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  unitToggleTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },

  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 10,
  },
  statBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  statBoxValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  statBoxSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  estimateDisclaimer: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },

  /* Guideline Card */
  guidelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
    padding: 14,
    marginBottom: 14,
  },
  guidelineCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#1e40af',
  },
  statutoryTag: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#1e40af',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
  guidelineCardRate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e3a8a',
    marginVertical: 4,
  },
  guidelineCardSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  guidelineCardNotice: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
  },

  resultActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  viewRecordsBtn: {
    flex: 1,
    backgroundColor: '#240046',
    borderRadius: 4,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  viewRecordsBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  adjustLocationBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  adjustLocationBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Insufficient Card */
  insufficientCard: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    padding: 16,
    marginBottom: 14,
  },
  insufficientBadge: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#92400e',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  insufficientHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginVertical: 6,
  },
  insufficientBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginBottom: 8,
  },
  recommendationsBox: {
    backgroundColor: '#fffdf5',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 4,
    padding: 10,
    marginVertical: 8,
  },
  recommendationsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78350f',
    marginBottom: 4,
  },
  recommendationItem: {
    fontSize: 11,
    color: '#92400e',
    lineHeight: 15,
  },
  selectDiffLocBtn: {
    backgroundColor: '#240046',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 8,
  },
  selectDiffLocBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Nearby Records */
  scopeTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    padding: 2,
    marginVertical: 8,
  },
  scopeTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 3,
  },
  scopeTabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  scopeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  scopeTabTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },

  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    minHeight: 44,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: '#240046',
    borderColor: '#240046',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },

  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    alignItems: 'center',
  },
  emptyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyCardSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },

  recordCard: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 10,
  },
  recordCardNear: {
    borderLeftWidth: 3,
    borderLeftColor: '#16a34a',
  },
  recordCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  recordLocalityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  recordSubMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  distPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  distPillGreen: {
    backgroundColor: '#f0fdf4',
  },
  distPillGray: {
    backgroundColor: '#f1f5f9',
  },
  distPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  distPillTextGreen: {
    color: '#166534',
  },
  distPillTextGray: {
    color: '#475569',
  },

  recordRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  recordCentRate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#240046',
  },
  recordSqFtRate: {
    fontSize: 11,
    color: '#64748b',
  },
  recordTotalPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  recordArea: {
    fontSize: 11,
    color: '#64748b',
  },

  recordBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  sourceTag: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
  },
  sourceTagGreen: {
    backgroundColor: '#f0fdf4',
  },
  sourceTagBlue: {
    backgroundColor: '#eff6ff',
  },
  sourceTagAmber: {
    backgroundColor: '#fff7ed',
  },
  sourceTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sourceTagTextGreen: {
    color: '#166534',
  },
  sourceTagTextBlue: {
    color: '#1d4ed8',
  },
  sourceTagTextAmber: {
    color: '#c2410c',
  },
  usageTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
  },
  usageTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  recordDateText: {
    marginLeft: 'auto',
    fontSize: 10,
    color: '#94a3b8',
  },

  /* Guideline & Methodology */
  guidelineHubCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 10,
  },
  guidelineHubTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  guidelineHubName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  guidelineHubDistrict: {
    fontSize: 11,
    color: '#64748b',
  },
  guidelineHubRate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e40af',
  },
  guidelineHubUnit: {
    fontSize: 10,
    color: '#64748b',
  },
  guidelineHubBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  guidelineHubSqFt: {
    fontSize: 11,
    color: '#475569',
  },
  guidelineHubRecords: {
    fontSize: 11,
    fontWeight: '600',
    color: '#240046',
  },

  principleItem: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  principleHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  principleText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },

  /* Bottom Navigation Bar */
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 58,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    gap: 2,
  },
  tabButtonActive: {
    borderTopWidth: 2,
    borderTopColor: '#240046',
  },
  tabButtonIcon: {
    fontSize: 16,
    color: '#64748b',
  },
  tabButtonIconActive: {
    color: '#240046',
    fontWeight: '700',
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  tabButtonTextActive: {
    color: '#240046',
    fontWeight: '700',
  },
});
