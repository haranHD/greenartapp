import React, { useState, useEffect, useRef, useMemo, Component, ErrorInfo, ReactNode } from 'react';
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
  Platform,
  BackHandler,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Safe insets hook: safely reads insets with fallback if context is unavailable
const useSafeInsets = () => {
  try {
    return useSafeAreaInsets();
  } catch {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
};
import {
  mobileApi,
  EstimateApiResponse,
  EstimateSuccessResponse,
  EstimateInsufficientDataResponse,
  LandRecordDto,
  NearbyLandRecordDto,
  LocalityReference,
  LocalitySuggestionDto,
  LocalityDetailsDto,
  HealthStatusResponse,
} from './src/services/api';
import { NativeInteractiveMap } from './src/components/NativeInteractiveMap';
import { FloatingBottomNav, MobileTab } from './src/components/FloatingBottomNav';
import { AppHeader } from './src/components/AppHeader';

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

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.errorContainer}>
          <Text style={styles.errorHeader}>Application Notice</Text>
          <Text style={styles.errorSubtext}>{this.state.errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={this.handleReload}
          >
            <Text style={styles.retryBtnText}>Reload Application</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

// =========================================================================
// Types & Constants
// =========================================================================
type EstimateStep = 'selection' | 'result';

export interface ValuationHistoryItem {
  id: string;
  locality: string;
  district: string;
  targetLat: number;
  targetLng: number;
  landUsage: number;
  landUsageLabel: string;
  ratePerCent: number;
  ratePerSqFt: number;
  confidence: string;
  comparableCount: number;
  calculatedAt: string;
}

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
// Main Application Component
// =========================================================================
function GreenartMobileApp() {
  const insets = useSafeInsets();
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [previousTab, setPreviousTab] = useState<MobileTab>('home');
  const [estimateStep, setEstimateStep] = useState<EstimateStep>('selection');

  // Selected Target Location & Zoning
  const [targetLat, setTargetLat] = useState<number>(11.0012);
  const [targetLng, setTargetLng] = useState<number>(77.0874);
  const [activeLocality, setActiveLocality] = useState<string>('Kannampalayam');
  const [landUsage, setLandUsage] = useState<number>(1);
  const [displayUnit, setDisplayUnit] = useState<'Cent' | 'SqFt'>('Cent');

  // Search & Navigation State
  const [showAdvancedCoords, setShowAdvancedCoords] = useState<boolean>(false);
  const [latInput, setLatInput] = useState<string>('11.0012');
  const [lngInput, setLngInput] = useState<string>('77.0874');
  const [homeSearchQuery, setHomeSearchQuery] = useState<string>('');
  const [searchTabQuery, setSearchTabQuery] = useState<string>('');
  const [mapZoom, setMapZoom] = useState<number>(15);

  // Valuation Calculation State
  const [loadingEstimate, setLoadingEstimate] = useState<boolean>(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<EstimateApiResponse | null>(null);

  // Real Valuation History (Session Saved Valuations)
  const [valuationHistory, setValuationHistory] = useState<ValuationHistoryItem[]>([]);

  // Backend Data State
  const [records, setRecords] = useState<LandRecordDto[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);
  const [localities, setLocalities] = useState<LocalityReference[]>([]);
  const [loadingLocalities, setLoadingLocalities] = useState<boolean>(false);
  const [backendHealth, setBackendHealth] = useState<HealthStatusResponse | null>(null);

  // Screen D: Server-Side Nearby Records State
  const [filterRecordSource, setFilterRecordSource] = useState<string>('All');
  const [recordsRadiusScope, setRecordsRadiusScope] = useState<'within1km' | 'all'>('within1km');
  const [nearbyRecords, setNearbyRecords] = useState<NearbyLandRecordDto[]>([]);
  const [loadingNearby, setLoadingNearby] = useState<boolean>(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  // Google Places Geocoding Autocomplete State
  const [homeGeocodingSuggestions, setHomeGeocodingSuggestions] = useState<LocalitySuggestionDto[]>([]);
  const [searchTabGeocodingSuggestions, setSearchTabGeocodingSuggestions] = useState<LocalitySuggestionDto[]>([]);
  const [isSearchingHomeGeocode, setIsSearchingHomeGeocode] = useState<boolean>(false);
  const [isSearchingTabGeocode, setIsSearchingTabGeocode] = useState<boolean>(false);
  const [resolvingPlaceId, setResolvingPlaceId] = useState<string | null>(null);

  // DOM ref for Leaflet on Web
  const webMapContainerRef = useRef<any>(null);
  const webMapInstanceRef = useRef<any>(null);

  // Request sequence trackers to discard stale responses and prevent duplicate submissions
  const calculationSeqRef = useRef<number>(0);
  const nearbySeqRef = useRef<number>(0);

  // Android Hardware Back Button Handling
  useEffect(() => {
    const onBackPress = () => {
      if (activeTab === 'estimate' && estimateStep === 'result') {
        setEstimateStep('selection');
        return true;
      }
      if (activeTab === 'records' || activeTab === 'guideline') {
        setActiveTab(previousTab);
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
  }, [activeTab, estimateStep, previousTab]);

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

  // 2. Server-side Proximity Fetching for Screen D
  const fetchNearbyRecords = async (lat: number, lng: number, scope: 'within1km' | 'all') => {
    const currentSeq = ++nearbySeqRef.current;
    setLoadingNearby(true);
    setNearbyError(null);
    try {
      const radius = scope === 'within1km' ? 1000 : 5000;
      const data = await mobileApi.getNearbyLandRecords(lat, lng, radius);
      if (nearbySeqRef.current !== currentSeq) return;
      setNearbyRecords(data);
    } catch (err: any) {
      if (nearbySeqRef.current !== currentSeq) return;
      console.warn('Failed to fetch nearby records:', err);
      setNearbyError(err?.message || 'Failed to retrieve nearby land records from server.');
      setNearbyRecords([]);
    } finally {
      if (nearbySeqRef.current === currentSeq) {
        setLoadingNearby(false);
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'records') {
      fetchNearbyRecords(targetLat, targetLng, recordsRadiusScope);
    }
  }, [activeTab, targetLat, targetLng, recordsRadiusScope]);

  // Debounced Google Places Autocomplete for Home Search
  useEffect(() => {
    if (!homeSearchQuery || homeSearchQuery.trim().length < 2) {
      setHomeGeocodingSuggestions([]);
      setIsSearchingHomeGeocode(false);
      return;
    }

    setIsSearchingHomeGeocode(true);
    const timer = setTimeout(async () => {
      try {
        const results = await mobileApi.searchLocalities(homeSearchQuery);
        setHomeGeocodingSuggestions(results);
      } catch (err) {
        console.warn('Geocoding search failed:', err);
        setHomeGeocodingSuggestions([]);
      } finally {
        setIsSearchingHomeGeocode(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [homeSearchQuery]);

  // Debounced Google Places Autocomplete for Search Tab
  useEffect(() => {
    if (!searchTabQuery || searchTabQuery.trim().length < 2) {
      setSearchTabGeocodingSuggestions([]);
      setIsSearchingTabGeocode(false);
      return;
    }

    setIsSearchingTabGeocode(true);
    const timer = setTimeout(async () => {
      try {
        const results = await mobileApi.searchLocalities(searchTabQuery);
        setSearchTabGeocodingSuggestions(results);
      } catch (err) {
        console.warn('Geocoding tab search failed:', err);
        setSearchTabGeocodingSuggestions([]);
      } finally {
        setIsSearchingTabGeocode(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [searchTabQuery]);

  // Handle selecting a Google Places Geocoding suggestion
  const handleSelectGeocodingSuggestion = async (suggestion: LocalitySuggestionDto, fromTab: 'home' | 'search') => {
    setResolvingPlaceId(suggestion.placeId);
    try {
      const details = await mobileApi.getLocalityDetails(suggestion.placeId);
      if (details) {
        handleSelectCoordinates(details.latitude, details.longitude, details.name);
      } else {
        setActiveLocality(suggestion.mainText);
      }
    } catch (err) {
      console.warn('Failed to resolve place details:', err);
      setActiveLocality(suggestion.mainText);
    } finally {
      setResolvingPlaceId(null);
      if (fromTab === 'home') setHomeSearchQuery('');
      if (fromTab === 'search') setSearchTabQuery('');
    }
  };

  // 3. Leaflet Web Map Setup (Preserved for Web Browser Viewport)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

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
      script.onload = () => initLeafletMap();
      document.head.appendChild(script);
    } else if ((window as any).L) {
      initLeafletMap();
    }

    function initLeafletMap() {
      const L = (window as any).L;
      if (!L || !webMapContainerRef.current) return;

      const createVioletIcon = () =>
        L.divIcon({
          className: 'custom-pin',
          html: '<div style="background-color:#240046;width:22px;height:22px;border-radius:11px;border:3px solid #D4AF37;box-shadow:0 3px 8px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;cursor:grab;"><div style="background-color:#ffffff;width:6px;height:6px;border-radius:3px;"></div></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

      const addRecordMarkers = (mapInstance: any) => {
        records.forEach((r) => {
          const dotColor =
            r.sourceCategory === 'VerifiedTransaction'
              ? '#16a34a'
              : r.sourceCategory === 'GovernmentGuideline'
                ? '#2563eb'
                : '#d97706';
          const recMarker = L.circleMarker([r.latitude, r.longitude], {
            radius: 5,
            color: '#FFFFFF',
            fillColor: dotColor,
            fillOpacity: 0.9,
            weight: 1.5,
          }).addTo(mapInstance);

          const typeLabel =
            r.sourceCategory === 'VerifiedTransaction'
              ? 'Verified Deed'
              : r.sourceCategory === 'GovernmentGuideline'
                ? 'TN Guideline'
                : 'Asking Price';
          recMarker.bindTooltip(`${typeLabel}: ₹${(r.normalizedRatePerCent / 100000).toFixed(2)}L/cent`, {
            direction: 'top',
            offset: [0, -5],
          });
        });
      };

      if (!webMapInstanceRef.current) {
        webMapInstanceRef.current = L.map(webMapContainerRef.current, {
          zoomControl: false,
          attributionControl: false,
        }).setView([targetLat, targetLng], mapZoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(webMapInstanceRef.current);

        const marker = L.marker([targetLat, targetLng], { icon: createVioletIcon(), draggable: true }).addTo(webMapInstanceRef.current);
        marker.bindTooltip(`Target Pin: ${targetLat.toFixed(4)}, ${targetLng.toFixed(4)}`, { direction: 'top', offset: [0, -12] });

        marker.on('dragend', (e: any) => {
          const pos = e.target.getLatLng();
          const lat = Math.round(pos.lat * 10000) / 10000;
          const lng = Math.round(pos.lng * 10000) / 10000;
          handleSelectCoordinates(lat, lng, 'Map Pin');
        });

        L.circle([targetLat, targetLng], {
          radius: 1000,
          color: '#D4AF37',
          weight: 2,
          fillColor: '#D4AF37',
          fillOpacity: 0.12,
        }).addTo(webMapInstanceRef.current);

        addRecordMarkers(webMapInstanceRef.current);

        webMapInstanceRef.current.on('click', (e: any) => {
          const lat = Math.round(e.latlng.lat * 10000) / 10000;
          const lng = Math.round(e.latlng.lng * 10000) / 10000;
          handleSelectCoordinates(lat, lng, 'Map Pin');
        });
      } else {
        webMapInstanceRef.current.setView([targetLat, targetLng], mapZoom);
        webMapInstanceRef.current.eachLayer((layer: any) => {
          if (layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.CircleMarker) {
            webMapInstanceRef.current.removeLayer(layer);
          }
        });

        const marker = L.marker([targetLat, targetLng], { icon: createVioletIcon(), draggable: true }).addTo(webMapInstanceRef.current);
        marker.bindTooltip(`Target Pin: ${targetLat.toFixed(4)}, ${targetLng.toFixed(4)}`, { direction: 'top', offset: [0, -12] });

        marker.on('dragend', (e: any) => {
          const pos = e.target.getLatLng();
          const lat = Math.round(pos.lat * 10000) / 10000;
          const lng = Math.round(pos.lng * 10000) / 10000;
          handleSelectCoordinates(lat, lng, 'Map Pin');
        });

        L.circle([targetLat, targetLng], {
          radius: 1000,
          color: '#D4AF37',
          weight: 2,
          fillColor: '#D4AF37',
          fillOpacity: 0.12,
        }).addTo(webMapInstanceRef.current);

        addRecordMarkers(webMapInstanceRef.current);
      }
    }

    const interval = setInterval(() => {
      if (webMapContainerRef.current && (window as any).L && !webMapInstanceRef.current) {
        initLeafletMap();
      }
    }, 400);

    return () => clearInterval(interval);
  }, [activeTab, targetLat, targetLng, mapZoom, activeLocality, records]);

  // 4. Coordinate & Locality Selection Handlers
  const handleSelectCoordinates = (lat: number, lng: number, localityName: string) => {
    setTargetLat(lat);
    setTargetLng(lng);
    setLatInput(lat.toFixed(4));
    setLngInput(lng.toFixed(4));
    setActiveLocality(localityName);
    setHomeSearchQuery(localityName === 'Map Pin' || localityName === 'Custom Coordinates' ? '' : localityName);
    setSearchTabQuery(localityName === 'Map Pin' || localityName === 'Custom Coordinates' ? '' : localityName);
  };

  const handleSelectLocalityRef = (loc: LocalityReference) => {
    handleSelectCoordinates(loc.latitude, loc.longitude, loc.name);
  };

  const handleManualCoordSubmit = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng)) {
      setEstimateError('Please enter valid numeric coordinates.');
      return;
    }
    handleSelectCoordinates(lat, lng, 'Custom Coordinates');
    executeCalculation(lat, lng, landUsage);
  };

  // 5. Valuation Calculation Action
  const executeCalculation = async (lat: number = targetLat, lng: number = targetLng, usage: number = landUsage) => {
    if (loadingEstimate) return; // Prevent duplicate rapid submission
    const currentSeq = ++calculationSeqRef.current;
    setLoadingEstimate(true);
    setEstimateError(null);
    setEstimateStep('result');
    setActiveTab('estimate');

    try {
      const res = await mobileApi.calculateEstimate(lat, lng, usage, 1000);
      if (calculationSeqRef.current !== currentSeq) return; // Discard stale response
      setEstimate(res);

      // Save real calculation to session Valuation History
      if (res && res.status === 'Success') {
        const estSuccess = res as EstimateSuccessResponse;
        const usageLabel = LAND_USAGES.find((u) => u.id === usage)?.label || 'Residential';
        const newHistoryItem: ValuationHistoryItem = {
          id: `${Date.now()}_${lat.toFixed(3)}_${lng.toFixed(3)}`,
          locality: activeLocality,
          district: 'Coimbatore',
          targetLat: lat,
          targetLng: lng,
          landUsage: usage,
          landUsageLabel: usageLabel,
          ratePerCent: estSuccess.priceRangePerCent.medianRate,
          ratePerSqFt: estSuccess.priceRangePerSqFt.medianRate,
          confidence: estSuccess.confidence,
          comparableCount: estSuccess.comparableRecordCount,
          calculatedAt: new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            day: 'numeric',
            month: 'short',
          }),
        };
        setValuationHistory((prev) => [
          newHistoryItem,
          ...prev.filter(
            (h) =>
              !(
                Math.abs(h.targetLat - lat) < 0.0001 &&
                Math.abs(h.targetLng - lng) < 0.0001 &&
                h.landUsage === usage
              )
          ),
        ].slice(0, 20));
      }
    } catch (err: any) {
      if (calculationSeqRef.current !== currentSeq) return;
      setEstimateError(err.message || 'Unable to calculate estimate from backend.');
      setEstimate(null);
    } finally {
      if (calculationSeqRef.current === currentSeq) {
        setLoadingEstimate(false);
      }
    }
  };

  // Search Autocomplete filtering
  const filterSuggestionsByText = (text: string) => {
    const q = text.toLowerCase().trim();
    if (!q) return [];
    return localities.filter(
      (loc) => loc.name.toLowerCase().includes(q) || loc.district.toLowerCase().includes(q)
    );
  };

  const homeFilteredSuggestions = filterSuggestionsByText(homeSearchQuery);
  const searchTabFilteredSuggestions = filterSuggestionsByText(searchTabQuery);

  // Screen D filtered nearby records
  const displayedNearbyRecords = nearbyRecords.filter((r) => {
    if (filterRecordSource === 'All') return true;
    return r.sourceCategory === filterRecordSource;
  });
  const nearbyWithin1kmCount = nearbyRecords.filter((r) => r.distanceMeters <= 1000).length;

  // Proximity count within 1,000m of targetLat, targetLng
  const pinRecordsWithin1km = useMemo(() => {
    return records.filter((r) => {
      const dLat = ((r.latitude - targetLat) * Math.PI) / 180;
      const dLon = ((r.longitude - targetLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((targetLat * Math.PI) / 180) *
        Math.cos((r.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = 6371000 * c;
      return distance <= 1000;
    }).length;
  }, [records, targetLat, targetLng]);

  const currentUsageObj = LAND_USAGES.find((u) => u.id === landUsage) || LAND_USAGES[0];

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Math.max(insets.top, 0) }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Compact Branded App Header */}
        <AppHeader
          isHealthy={backendHealth?.status === 'Healthy'}
          onPressProfile={() => {
            setPreviousTab(activeTab);
            setActiveTab('profile');
          }}
        />

        {/* =========================================================================
            SCREEN VIEWPORT CONTAINER
            ========================================================================= */}
        <View style={styles.screenContainer}>
          {/* =====================================================================
              1. HOME SCREEN (Redesigned per Visual Reference & Specs)
              ===================================================================== */}
          {activeTab === 'home' && (
            <ScrollView
              contentContainerStyle={[styles.scrollBody, { paddingBottom: 110 + insets.bottom }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Premium Hero Surface */}
              <View style={styles.homeHeroCard}>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>Land Market Rate Analyst</Text>
                </View>
                <Text style={styles.homeHeroTitle}>Discover your land's value.</Text>
                <Text style={styles.homeHeroSub}>
                  Explore nearby land records and understand local market rates.
                </Text>
              </View>

              {/* Primary Location-Search Card */}
              <View style={styles.primarySearchCard}>
                <Text style={styles.searchCardTitle}>Find a property</Text>
                <Text style={styles.searchCardSub}>
                  Search across available localities, towns, and districts:
                </Text>

                <View style={styles.searchBarBox}>
                  <View style={styles.searchIconRing}>
                    <View style={styles.searchIconCircle} />
                    <View style={styles.searchIconHandle} />
                  </View>
                  <TextInput
                    style={styles.searchBarInput}
                    placeholder="Enter locality (e.g. Kannampalayam, Sulur)..."
                    placeholderTextColor="#94A3B8"
                    value={homeSearchQuery}
                    onChangeText={setHomeSearchQuery}
                    returnKeyType="search"
                  />
                  {homeSearchQuery ? (
                    <TouchableOpacity onPress={() => setHomeSearchQuery('')} style={{ padding: 6 }}>
                      <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700' }}>✕</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Autocomplete Suggestions Dropdown */}
                {homeSearchQuery.trim() !== '' && (
                  <View style={styles.suggestionsContainer}>
                    {isSearchingHomeGeocode && homeGeocodingSuggestions.length === 0 && (
                      <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ActivityIndicator size="small" color="#240046" />
                        <Text style={{ fontSize: 12, color: '#64748B' }}>Searching locations via Google Places...</Text>
                      </View>
                    )}

                    {/* Google Places Geocoding Suggestions */}
                    {homeGeocodingSuggestions.map((item) => (
                      <TouchableOpacity
                        key={item.placeId}
                        style={styles.suggestionRow}
                        onPress={() => handleSelectGeocodingSuggestion(item, 'home')}
                        disabled={resolvingPlaceId === item.placeId}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suggestionName}>{item.mainText}</Text>
                          <Text style={styles.suggestionDistrict}>{item.secondaryText}</Text>
                        </View>
                        {resolvingPlaceId === item.placeId ? (
                          <ActivityIndicator size="small" color="#D4AF37" />
                        ) : (
                          <View style={styles.suggestionCountBadge}>
                            <Text style={styles.suggestionCountText}>Place</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}

                    {/* Pilot Reference Locality Fallback */}
                    {homeFilteredSuggestions
                      .filter((loc) => !homeGeocodingSuggestions.some((g) => g.mainText.toLowerCase() === loc.name.toLowerCase()))
                      .map((loc) => (
                        <TouchableOpacity
                          key={loc.name}
                          style={styles.suggestionRow}
                          onPress={() => {
                            handleSelectLocalityRef(loc);
                            setHomeSearchQuery('');
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.suggestionName}>{loc.name}</Text>
                            <Text style={styles.suggestionDistrict}>{loc.district}</Text>
                          </View>
                          <View style={styles.suggestionCountBadge}>
                            <Text style={styles.suggestionCountText}>{loc.recordCount} Records</Text>
                          </View>
                        </TouchableOpacity>
                      ))}

                    {!isSearchingHomeGeocode &&
                      homeGeocodingSuggestions.length === 0 &&
                      homeFilteredSuggestions.length === 0 && (
                        <Text style={styles.noSuggestionsText}>No matching localities found.</Text>
                      )}
                  </View>
                )}

                {/* Selected Location Pill */}
                <View style={styles.selectedLocalityBar}>
                  <View style={styles.locPinDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedLocalityName}>
                      {activeLocality}{' '}
                      <Text style={styles.selectedLocalityCoords}>
                        ({targetLat.toFixed(4)}, {targetLng.toFixed(4)})
                      </Text>
                    </Text>
                    <Text style={styles.selectedLocalityDistrict}>
                      Coimbatore District • {currentUsageObj.label} Zoning
                    </Text>
                  </View>
                </View>

                {/* Action Buttons Row */}
                <View style={styles.searchCtaRow}>
                  {/* Primary CTA */}
                  <TouchableOpacity
                    style={styles.primaryFindBtn}
                    onPress={() => executeCalculation(targetLat, targetLng, landUsage)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryFindBtnText}>Find Land Value</Text>
                  </TouchableOpacity>

                  {/* Secondary Action */}
                  <TouchableOpacity
                    style={styles.secondaryMapBtn}
                    onPress={() => setActiveTab('search')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryMapBtnText}>Choose on map</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Compact Feature Cards (3 destinations) */}
              <View style={styles.featureGrid}>
                {/* 1. Market Estimate */}
                <TouchableOpacity
                  style={styles.featureCard}
                  onPress={() => {
                    setActiveTab('estimate');
                    setEstimateStep('selection');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.featureIconBadge, { backgroundColor: '#F3E8FF' }]}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#581C87' }} />
                  </View>
                  <Text style={styles.featureCardTitle}>Market Estimate</Text>
                  <Text style={styles.featureCardDesc}>
                    Statistical 1,000m radius median land valuation.
                  </Text>
                  <Text style={styles.featureCardLink}>Explore Valuation →</Text>
                </TouchableOpacity>

                {/* 2. Nearby Land Records */}
                <TouchableOpacity
                  style={styles.featureCard}
                  onPress={() => {
                    setPreviousTab('home');
                    setActiveTab('records');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.featureIconBadge, { backgroundColor: '#FEF3C7' }]}>
                    <View style={{ width: 12, height: 8, borderWidth: 1.5, borderColor: '#D97706', borderRadius: 2 }} />
                  </View>
                  <Text style={styles.featureCardTitle}>Nearby Records</Text>
                  <Text style={styles.featureCardDesc}>
                    PostGIS spatial proximity deeds and asking prices.
                  </Text>
                  <Text style={[styles.featureCardLink, { color: '#B45309' }]}>View Comparables →</Text>
                </TouchableOpacity>

                {/* 3. Government Guideline Rate */}
                <TouchableOpacity
                  style={styles.featureCard}
                  onPress={() => {
                    setPreviousTab('home');
                    setActiveTab('guideline');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.featureIconBadge, { backgroundColor: '#DBEAFE' }]}>
                    <View style={{ width: 12, height: 12, borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#1D4ED8' }} />
                  </View>
                  <Text style={styles.featureCardTitle}>Guideline Rate</Text>
                  <Text style={styles.featureCardDesc}>
                    Official TNREGINET statutory stamp duty rates.
                  </Text>
                  <Text style={[styles.featureCardLink, { color: '#1D4ED8' }]}>Statutory Rates →</Text>
                </TouchableOpacity>
              </View>

              {/* Transparent Valuation Trust Statement */}
              <View style={styles.trustCard}>
                <View style={styles.trustHeaderRow}>
                  <View style={styles.shieldIconRing}>
                    <View style={styles.shieldInner} />
                  </View>
                  <Text style={styles.trustTitle}>Transparent Valuation</Text>
                </View>
                <Text style={styles.trustDesc}>
                  Estimates depend strictly on registered comparable transactions within 1,000 metres. If evidence is insufficient, our statistical engine requires field verification rather than generating speculative pricing.
                </Text>
                <View style={styles.trustPillsRow}>
                  <View style={styles.trustPillItem}>
                    <Text style={styles.trustPillItemText}>1,000m Geodesic Radius</Text>
                  </View>
                  <View style={styles.trustPillItem}>
                    <Text style={styles.trustPillItemText}>Zero Synthetic Rates</Text>
                  </View>
                  <View style={styles.trustPillItem}>
                    <Text style={styles.trustPillItemText}>Statutory Separation</Text>
                  </View>
                </View>
              </View>

              {/* Dedicated Methodology & Coverage Shortcut Bar */}
              <View style={styles.homeFootLinksRow}>
                <TouchableOpacity
                  style={styles.footLinkBtn}
                  onPress={() => {
                    setPreviousTab('home');
                    setActiveTab('guideline');
                  }}
                >
                  <Text style={styles.footLinkText}>Valuation Methodology</Text>
                </TouchableOpacity>
                <Text style={styles.footLinkSep}>•</Text>
                <TouchableOpacity
                  style={styles.footLinkBtn}
                  onPress={() => setActiveTab('search')}
                >
                  <Text style={styles.footLinkText}>Pilot Coverage Map</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* =====================================================================
              2. SEARCH SCREEN: INTERACTIVE MAP & LOCALITY EXPLORER
              ===================================================================== */}
          {activeTab === 'search' && (
            <ScrollView
              contentContainerStyle={[styles.scrollBody, { paddingBottom: 110 + insets.bottom }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Screen Title & Subtitle */}
              <View style={styles.screenHeaderBox}>
                <Text style={styles.viewTitle}>Location Explorer</Text>
                <Text style={styles.viewSubtitle}>
                  Pan, zoom, or tap the interactive map to select target coordinates.
                </Text>
              </View>

              {/* Locality Search Input */}
              <View style={styles.card}>
                <View style={styles.searchBarBox}>
                  <TextInput
                    style={styles.searchBarInput}
                    placeholder="Search locality or enter coords..."
                    placeholderTextColor="#94A3B8"
                    value={searchTabQuery}
                    onChangeText={setSearchTabQuery}
                  />
                  {searchTabQuery ? (
                    <TouchableOpacity onPress={() => setSearchTabQuery('')} style={{ padding: 6 }}>
                      <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700' }}>✕</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {searchTabQuery.trim() !== '' && (
                  <View style={styles.suggestionsContainer}>
                    {isSearchingTabGeocode && searchTabGeocodingSuggestions.length === 0 && (
                      <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ActivityIndicator size="small" color="#240046" />
                        <Text style={{ fontSize: 12, color: '#64748B' }}>Searching locations via Google Places...</Text>
                      </View>
                    )}

                    {/* Google Places Geocoding Suggestions */}
                    {searchTabGeocodingSuggestions.map((item) => (
                      <TouchableOpacity
                        key={item.placeId}
                        style={styles.suggestionRow}
                        onPress={() => handleSelectGeocodingSuggestion(item, 'search')}
                        disabled={resolvingPlaceId === item.placeId}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suggestionName}>{item.mainText}</Text>
                          <Text style={styles.suggestionDistrict}>{item.secondaryText}</Text>
                        </View>
                        {resolvingPlaceId === item.placeId ? (
                          <ActivityIndicator size="small" color="#D4AF37" />
                        ) : (
                          <View style={styles.suggestionCountBadge}>
                            <Text style={styles.suggestionCountText}>Place</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}

                    {/* Pilot Reference Locality Fallback */}
                    {searchTabFilteredSuggestions
                      .filter((loc) => !searchTabGeocodingSuggestions.some((g) => g.mainText.toLowerCase() === loc.name.toLowerCase()))
                      .map((loc) => (
                        <TouchableOpacity
                          key={loc.name}
                          style={styles.suggestionRow}
                          onPress={() => {
                            handleSelectLocalityRef(loc);
                            setSearchTabQuery('');
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.suggestionName}>{loc.name}</Text>
                            <Text style={styles.suggestionDistrict}>{loc.district}</Text>
                          </View>
                          <View style={styles.suggestionCountBadge}>
                            <Text style={styles.suggestionCountText}>{loc.recordCount} Records</Text>
                          </View>
                        </TouchableOpacity>
                      ))}

                    {!isSearchingTabGeocode &&
                      searchTabGeocodingSuggestions.length === 0 &&
                      searchTabFilteredSuggestions.length === 0 && (
                        <Text style={styles.noSuggestionsText}>No matching localities found.</Text>
                      )}
                  </View>
                )}

                {/* Quick Locality Shortcut Chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, marginTop: 10 }}
                >
                  {localities.map((loc) => {
                    const isSelected = activeLocality === loc.name;
                    return (
                      <TouchableOpacity
                        key={loc.name}
                        style={[styles.localityChip, isSelected && styles.localityChipActive]}
                        onPress={() => handleSelectLocalityRef(loc)}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.localityChipText,
                            isSelected && styles.localityChipTextActive,
                          ]}
                        >
                          {loc.name} ({loc.recordCount})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Interactive Geographic Map Card */}
              <View style={styles.mapCard}>
                <View style={styles.mapCardHeader}>
                  <View>
                    <Text style={styles.mapCardTitle}>{activeLocality}</Text>
                    <Text style={styles.mapCardSubtitle}>
                      {targetLat.toFixed(4)}° N, {targetLng.toFixed(4)}° E • 1,000m Buffer
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
                  <NativeInteractiveMap
                    targetLat={targetLat}
                    targetLng={targetLng}
                    mapZoom={mapZoom}
                    activeLocality={activeLocality}
                    records={records}
                    onSelectLocation={(lat, lng) => handleSelectCoordinates(lat, lng, 'Map Pin')}
                  />
                )}

                <View style={styles.mapFooterBar}>
                  <Text style={styles.mapFooterCoord}>Tap map to reposition center pin</Text>
                  <Text style={styles.mapFooterRadius}>Radius: 1,000m</Text>
                </View>
              </View>

              {/* Selected Pin Confirmation & Immediate Valuation Card */}
              <View style={styles.pinConfirmationCard}>
                <View style={styles.pinHeaderRow}>
                  <View style={styles.pinIconWrap}>
                    <View style={styles.pinDotInner} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pinConfirmationTitle}>Target Pin Confirmed</Text>
                    <Text style={styles.pinConfirmationCoords}>
                      {targetLat.toFixed(4)}° N, {targetLng.toFixed(4)}° E
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.pinCountBadge,
                      pinRecordsWithin1km >= 3 ? styles.pinCountBadgeSuccess : styles.pinCountBadgeWarning,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pinCountBadgeText,
                        pinRecordsWithin1km >= 3 ? styles.pinCountBadgeTextSuccess : styles.pinCountBadgeTextWarning,
                      ]}
                    >
                      {pinRecordsWithin1km} Comparable{pinRecordsWithin1km === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>

                <View style={styles.pinInfoDivider} />

                <View style={styles.pinMetaRow}>
                  <Text style={styles.pinMetaLabel}>Locality Context</Text>
                  <Text style={styles.pinMetaValue}>{activeLocality}</Text>
                </View>
                <View style={styles.pinMetaRow}>
                  <Text style={styles.pinMetaLabel}>Spatial Proximity</Text>
                  <Text style={styles.pinMetaValue}>1,000m Radius Buffer</Text>
                </View>
                <View style={styles.pinMetaRow}>
                  <Text style={styles.pinMetaLabel}>Zoning Category</Text>
                  <Text style={styles.pinMetaValue}>{currentUsageObj.label}</Text>
                </View>

                {/* Primary CTA */}
                <TouchableOpacity
                  style={styles.primaryFindBtn}
                  onPress={() => executeCalculation(targetLat, targetLng, landUsage)}
                  disabled={loadingEstimate}
                  activeOpacity={0.85}
                >
                  {loadingEstimate ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryFindBtnText}>Find Land Value for this Pin</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Relocated Active Pilot Corridors List */}
              <View style={styles.sectionCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionHeaderTitle}>Active Pilot Corridors</Text>
                  <Text style={styles.badgeSubtle}>{localities.length} Corridors</Text>
                </View>
                <Text style={styles.sectionHeaderDesc}>
                  Reference corridors with verified transaction and guideline evidence:
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
                        onPress={() => handleSelectLocalityRef(loc)}
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
              3. ESTIMATE SCREEN: ELEVATED VALUATION WORKFLOW & RESULTS
              ===================================================================== */}
          {activeTab === 'estimate' && (
            <ScrollView
              contentContainerStyle={[styles.scrollBody, { paddingBottom: 110 + insets.bottom }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
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
                <>
                  {/* Selected Target Card */}
                  <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <View>
                        <Text style={styles.cardTitle}>{activeLocality}</Text>
                        <Text style={styles.cardSubtitle}>
                          {targetLat.toFixed(4)}° N, {targetLng.toFixed(4)}° E • Coimbatore
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.changeLocBtn}
                        onPress={() => setActiveTab('search')}
                      >
                        <Text style={styles.changeLocBtnText}>Change on Map</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Zoning Classification Card */}
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
                  </View>

                  {/* Primary Calculate Valuation CTA */}
                  <TouchableOpacity
                    style={styles.primaryActionBtn}
                    onPress={() => executeCalculation(targetLat, targetLng, landUsage)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryActionBtnText}>Calculate Land Valuation</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* STEP 2: VALUATION RESULTS */}
              {estimateStep === 'result' && (
                <>
                  {loadingEstimate ? (
                    <View style={styles.loadingCard}>
                      <ActivityIndicator size="large" color="#240046" />
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
                              <View>
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
                                  {estSuccess.confidence} Confidence ({estSuccess.comparableRecordCount} Records)
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
                              style={[styles.secondaryActionBtn, { borderColor: '#581C87' }]}
                              onPress={() => setActiveTab('search')}
                            >
                              <Text style={[styles.secondaryActionBtnText, { color: '#581C87' }]}>
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
                        <View style={styles.insufficientDataCard}>
                          <View style={styles.insufficientBadge}>
                            <Text style={styles.insufficientBadgeText}>Evidence Notice</Text>
                          </View>
                          <Text style={styles.insufficientTitle}>Insufficient Data within 1,000m</Text>
                          <Text style={styles.insufficientSub}>
                            {insuff.message ||
                              `Found ${insuff.comparableRecordsFound} records within 1,000m. A minimum of ${insuff.minimumRequiredRecords} verified market transactions is strictly required.`}
                          </Text>
                          {insuff.recommendations && insuff.recommendations.length > 0 && (
                            <Text style={styles.insufficientAdvice}>
                              {insuff.recommendations.join(' ')}
                            </Text>
                          )}

                          {guideline && (
                            <View style={[styles.guidelineCard, { marginTop: 14, backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                              <View style={styles.guidelineTopRow}>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.guidelineTag, { color: '#166534' }]}>Statutory Guideline Value</Text>
                                  <Text style={styles.guidelineSubTitle}>
                                    {guideline.locality ? `${guideline.locality}` : 'TNREGINET Official Benchmark'}
                                  </Text>
                                </View>
                                <Text style={[styles.guidelineRateVal, { color: '#15803D' }]}>
                                  {formatLakhs(guideline.guidelineRatePerCent)} / Cent
                                </Text>
                              </View>
                              <Text style={{ fontSize: 11, color: '#166534', marginTop: 3, fontWeight: '600' }}>
                                ₹{Number(guideline.guidelineRatePerSqFt).toLocaleString('en-IN')} / Sq.Ft
                              </Text>
                              <Text style={[styles.guidelineNotice, { color: '#166534', marginTop: 6 }]}>
                                {guideline.legalNotice ||
                                  'Government statutory minimum used for stamp duty registration. Kept strictly separate from open-market valuations.'}
                              </Text>
                            </View>
                          )}

                          <TouchableOpacity
                            style={[styles.primaryActionBtn, { marginTop: 16 }]}
                            onPress={() => setActiveTab('search')}
                          >
                            <Text style={styles.primaryActionBtnText}>Adjust Pin on Interactive Map</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })()
                  ) : null}
                </>
              )}
            </ScrollView>
          )}

          {/* =====================================================================
              4. HISTORY SCREEN: REAL VALUATION LOG & HONEST EMPTY STATE
              ===================================================================== */}
          {activeTab === 'history' && (
            <ScrollView
              contentContainerStyle={[styles.scrollBody, { paddingBottom: 110 + insets.bottom }]}
              showsVerticalScrollIndicator={false}
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
                  {/* Vector Clock Icon */}
                  <View style={styles.emptyIconCircle}>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: '#240046',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <View style={{ width: 1.5, height: 6, backgroundColor: '#240046', marginBottom: -2 }} />
                      <View style={{ width: 5, height: 1.5, backgroundColor: '#240046', alignSelf: 'center', marginLeft: 4 }} />
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
          )}

          {/* =====================================================================
              5. PROFILE SCREEN: CLIENT PORTAL & SYSTEM DIAGNOSTICS
              ===================================================================== */}
          {activeTab === 'profile' && (
            <ScrollView
              contentContainerStyle={[styles.scrollBody, { paddingBottom: 110 + insets.bottom }]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.screenHeaderBox}>
                <Text style={styles.viewTitle}>Client Portal</Text>
                <Text style={styles.viewSubtitle}>
                  Institutional property valuation intelligence & system status.
                </Text>
              </View>

              {/* Profile Card */}
              <View style={styles.card}>
                <View style={styles.profileHeroRow}>
                  <View style={styles.profileHeroAvatar}>
                    <Text style={styles.profileHeroAvatarText}>GA</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileOrgName}>Greenart Properties</Text>
                    <Text style={styles.profileRoleTitle}>Land Market Rate Analyst</Text>
                    <Text style={styles.profileCorridorTag}>Coimbatore Pilot Corridors</Text>
                  </View>
                </View>
              </View>

              {/* System & PostGIS Diagnostics Card */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>System Diagnostics</Text>
                <Text style={styles.cardSubtitle}>
                  PostgreSQL/PostGIS spatial architecture verification:
                </Text>

                <View style={styles.diagItemRow}>
                  <Text style={styles.diagItemKey}>Backend Engine</Text>
                  <Text style={styles.diagItemVal}>ASP.NET Core 8.0</Text>
                </View>
                <View style={styles.diagItemRow}>
                  <Text style={styles.diagItemKey}>Database Engine</Text>
                  <Text style={styles.diagItemVal}>PostgreSQL 16</Text>
                </View>
                <View style={styles.diagItemRow}>
                  <Text style={styles.diagItemKey}>Spatial Extension</Text>
                  <Text style={styles.diagItemVal}>
                    {backendHealth?.database?.postgisVersion || 'PostGIS 3.4'}
                  </Text>
                </View>
                <View style={styles.diagItemRow}>
                  <Text style={styles.diagItemKey}>Spatial Indexing</Text>
                  <Text style={styles.diagItemVal}>GIST (SRID 4326)</Text>
                </View>
                <View style={styles.diagItemRow}>
                  <Text style={styles.diagItemKey}>API Health</Text>
                  <Text
                    style={[
                      styles.diagItemVal,
                      { color: backendHealth?.status === 'Healthy' ? '#16A34A' : '#D97706' },
                    ]}
                  >
                    {backendHealth?.status === 'Healthy' ? 'Online (Port 5039)' : 'Reconnecting'}
                  </Text>
                </View>
              </View>

              {/* Statutory Framework */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Statutory Benchmark Compliance</Text>
                <Text style={styles.cardSubtitle}>
                  Tamil Nadu Registration Department (TNREGINET)
                </Text>
                <Text style={styles.profileNoticeText}>
                  All market rates are derived strictly from open-market verified transactions. Government guideline rates are maintained purely as statutory reference points for stamp duty benchmarks.
                </Text>

                <TouchableOpacity
                  style={[styles.secondaryActionBtn, { marginTop: 12 }]}
                  onPress={() => {
                    setPreviousTab('profile');
                    setActiveTab('guideline');
                  }}
                >
                  <Text style={styles.secondaryActionBtnText}>Read Full Methodology</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* =====================================================================
              SUB-SCREEN: NEARBY RECORDS (Screen D)
              ===================================================================== */}
          {activeTab === 'records' && (
            <ScrollView
              contentContainerStyle={[styles.scrollBody, { paddingBottom: 110 + insets.bottom }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Back Nav Bar */}
              <TouchableOpacity
                style={styles.subBackBtn}
                onPress={() => setActiveTab(previousTab)}
              >
                <Text style={styles.subBackBtnText}>← Back to {previousTab === 'home' ? 'Home' : 'Valuation'}</Text>
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
          )}

          {/* =====================================================================
              SUB-SCREEN: GUIDELINE & METHODOLOGY (Screen E)
              ===================================================================== */}
          {activeTab === 'guideline' && (
            <ScrollView
              contentContainerStyle={[styles.scrollBody, { paddingBottom: 110 + insets.bottom }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Back Nav Bar */}
              <TouchableOpacity
                style={styles.subBackBtn}
                onPress={() => setActiveTab(previousTab)}
              >
                <Text style={styles.subBackBtnText}>← Back to {previousTab === 'home' ? 'Home' : 'Profile'}</Text>
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

              {/* Relocated: How the Valuation Engine Works */}
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
          )}
        </View>

        {/* =========================================================================
            FLOATING BOTTOM NAVIGATION BAR (Image 1 Architecture)
            ========================================================================= */}
        <FloatingBottomNav
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (tab === 'estimate') {
              setEstimateStep('selection');
            }
            setActiveTab(tab);
          }}
          bottomInset={insets.bottom}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// =========================================================================
// Root Export with Error Boundary & Platform Insets
// =========================================================================
const WEB_INITIAL_METRICS = {
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
  frame: {
    x: 0,
    y: 0,
    width: typeof window !== 'undefined' ? window.innerWidth : 412,
    height: typeof window !== 'undefined' ? window.innerHeight : 922,
  },
};

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={Platform.OS === 'web' ? WEB_INITIAL_METRICS : undefined}>
      <SafeErrorBoundary>
        <GreenartMobileApp />
      </SafeErrorBoundary>
    </SafeAreaProvider>
  );
}

// =========================================================================
// Mobile Stylesheet (Brand Restrained Palette)
// =========================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7FA',
  },
  screenContainer: {
    flex: 1,
  },
  scrollBody: {
    padding: 16,
    gap: 12,
  },

  /* Error Container */
  errorContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#240046',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Screen Header Box */
  screenHeaderBox: {
    marginBottom: 4,
  },
  viewTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A0033',
    letterSpacing: -0.3,
  },
  viewSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  /* ---------------- HOME SCREEN ---------------- */
  homeHeroCard: {
    backgroundColor: '#1A0033',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D124D',
    shadowColor: '#1A0033',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  heroPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: '#D4AF37',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  heroPillText: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  homeHeroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  homeHeroSub: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 19,
    marginTop: 6,
  },

  /* Primary Search Card */
  primarySearchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#1A0033',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  searchCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A0033',
  },
  searchCardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 12,
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 46,
  },
  searchIconRing: {
    width: 16,
    height: 16,
    marginRight: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIconCircle: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1.5,
    borderColor: '#64748B',
  },
  searchIconHandle: {
    position: 'absolute',
    width: 4.5,
    height: 1.5,
    backgroundColor: '#64748B',
    bottom: 0.5,
    right: 0.5,
    transform: [{ rotate: '45deg' }],
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 6,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  suggestionDistrict: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  suggestionCountBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  suggestionCountText: {
    fontSize: 11,
    color: '#581C87',
    fontWeight: '600',
  },
  noSuggestionsText: {
    fontSize: 12,
    color: '#64748B',
    padding: 12,
    textAlign: 'center',
  },
  selectedLocalityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  locPinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#240046',
    marginRight: 10,
  },
  selectedLocalityName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  selectedLocalityCoords: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  selectedLocalityDistrict: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  searchCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  primaryFindBtn: {
    flex: 2,
    height: 46,
    backgroundColor: '#240046',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryFindBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryMapBtn: {
    flex: 1.2,
    height: 46,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#240046',
  },
  secondaryMapBtnText: {
    color: '#240046',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Feature Cards (3 destinations) */
  featureGrid: {
    gap: 10,
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#1A0033',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  featureIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  featureCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A0033',
  },
  featureCardDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  featureCardLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#581C87',
    marginTop: 8,
  },

  /* Trust Statement Card */
  trustCard: {
    backgroundColor: '#FAF5FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  trustHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  shieldIconRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#240046',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  shieldInner: {
    width: 6,
    height: 6,
    backgroundColor: '#D4AF37',
    borderRadius: 3,
  },
  trustTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#240046',
  },
  trustDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  trustPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  trustPillItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  trustPillItemText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#581C87',
  },
  homeFootLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 6,
    paddingVertical: 8,
  },
  footLinkBtn: {
    paddingVertical: 4,
  },
  footLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#581C87',
  },
  footLinkSep: {
    fontSize: 12,
    color: '#94A3B8',
  },

  /* ---------------- SEARCH SCREEN ---------------- */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#1A0033',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A0033',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  localityChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  localityChipActive: {
    backgroundColor: '#240046',
    borderColor: '#240046',
  },
  localityChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  localityChipTextActive: {
    color: '#FFFFFF',
  },
  mapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#1A0033',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  mapCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  mapCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A0033',
  },
  mapCardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  mapZoomControls: {
    flexDirection: 'row',
    gap: 4,
  },
  zoomBtn: {
    width: 28,
    height: 28,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  zoomBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#240046',
  },
  leafletCanvas: {
    height: 280,
    width: '100%',
    backgroundColor: '#E2E8F0',
  },
  mapFooterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  mapFooterCoord: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  mapFooterRadius: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D4AF37',
  },

  /* Pin Confirmation Card & Live Status */
  pinConfirmationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    padding: 16,
    gap: 10,
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  pinHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pinIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#240046',
    borderWidth: 2,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  pinConfirmationTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A0033',
  },
  pinConfirmationCoords: {
    fontSize: 12,
    fontWeight: '600',
    color: '#581C87',
    marginTop: 1,
  },
  pinCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  pinCountBadgeSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  pinCountBadgeWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  pinCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pinCountBadgeTextSuccess: {
    color: '#047857',
  },
  pinCountBadgeTextWarning: {
    color: '#B45309',
  },
  pinInfoDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 2,
  },
  pinMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pinMetaLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  pinMetaValue: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '700',
  },

  /* Common Primary / Secondary Action Buttons */
  primaryActionBtn: {
    height: 48,
    backgroundColor: '#240046',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
    letterSpacing: 0.2,
  },
  secondaryActionBtn: {
    height: 46,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#240046',
  },
  secondaryActionBtnText: {
    color: '#240046',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Hotspot / Pilot Corridors Grid */
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A0033',
  },
  sectionHeaderDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
  },
  hotspotGrid: {
    gap: 8,
  },
  hotspotCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hotspotCardActive: {
    borderColor: '#240046',
    backgroundColor: '#FAF5FF',
  },
  hotspotTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hotspotName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  hotspotBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#581C87',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hotspotDistrict: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  hotspotRate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#240046',
    marginTop: 4,
  },
  badgeSubtle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },

  /* ---------------- ESTIMATE SCREEN ---------------- */
  stepTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  stepTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  stepTabBtnActive: {
    backgroundColor: '#240046',
  },
  stepTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  stepTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  changeLocBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  changeLocBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#581C87',
  },
  usageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  usageChipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
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
    color: '#FFFFFF',
  },
  unitToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
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
    fontWeight: '600',
    color: '#64748B',
  },
  unitPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  advancedDrawerToggle: {
    marginTop: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  advancedDrawerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#581C87',
  },
  advancedDrawerContent: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  coordInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputMiniLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 3,
  },
  coordTextInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#1E293B',
  },
  applyCoordBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  applyCoordBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#240046',
  },

  /* Results Presentation */
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  loadingCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A0033',
    marginTop: 14,
  },
  loadingCardSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B',
  },
  errorCardSub: {
    fontSize: 12,
    color: '#7F1D1D',
    marginTop: 4,
    marginBottom: 12,
  },
  valuationHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#1A0033',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  valHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  valTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D4AF37',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valLocalityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A0033',
    marginTop: 2,
  },
  confidencePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  confidencePillHigh: {
    backgroundColor: '#DCFCE7',
  },
  confidencePillModerate: {
    backgroundColor: '#FEF3C7',
  },
  confidencePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#14532D',
  },
  bigRateDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 14,
  },
  bigRateNumber: {
    fontSize: 30,
    fontWeight: '800',
    color: '#240046',
    letterSpacing: -0.5,
  },
  bigRateUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 6,
  },
  convertedRateSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  rangesGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  rangeBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rangeBoxLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  rangeBoxVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 3,
  },
  estimateDisclaimer: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 12,
    lineHeight: 14,
    fontStyle: 'italic',
  },
  guidelineCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  guidelineTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  guidelineTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
    textTransform: 'uppercase',
  },
  guidelineSubTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
    marginTop: 2,
  },
  guidelineRateVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E40AF',
  },
  guidelineNotice: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 6,
    lineHeight: 15,
  },
  insufficientDataCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  insufficientBadge: {
    backgroundColor: '#FEF3C7',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
  },
  insufficientBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  insufficientTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  insufficientSub: {
    fontSize: 12,
    color: '#78350F',
    marginTop: 4,
    lineHeight: 17,
  },
  insufficientAdvice: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 6,
    fontStyle: 'italic',
  },

  /* ---------------- HISTORY SCREEN ---------------- */
  historyMetaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  historyCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  historyClearBtn: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#1A0033',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  historyCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  historyLocalityName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A0033',
  },
  historyMetaSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  historyConfidenceBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  historyConfidenceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#581C87',
  },
  historyRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  historyRateCent: {
    fontSize: 15,
    fontWeight: '800',
    color: '#240046',
  },
  historyRateSqFt: {
    fontSize: 11,
    color: '#64748B',
  },
  historyViewBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  historyViewBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#240046',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FAF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A0033',
  },
  emptyCardSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },

  /* ---------------- PROFILE SCREEN ---------------- */
  profileHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileHeroAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#240046',
    borderWidth: 2,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeroAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  profileOrgName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A0033',
  },
  profileRoleTitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  profileCorridorTag: {
    fontSize: 10,
    fontWeight: '600',
    color: '#581C87',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  diagItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  diagItemKey: {
    fontSize: 12,
    color: '#64748B',
  },
  diagItemVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  profileNoticeText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginTop: 8,
  },

  /* ---------------- SUB-SCREENS: RECORDS & GUIDELINE ---------------- */
  subBackBtn: {
    paddingVertical: 6,
    marginBottom: 4,
  },
  subBackBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#240046',
  },
  scopeTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 4,
    marginTop: 10,
  },
  scopeTabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  scopeTabBtnActive: {
    backgroundColor: '#240046',
  },
  scopeTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  scopeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
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
    color: '#FFFFFF',
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  recordCardNear: {
    borderColor: '#D4AF37',
  },
  recordCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  recordLocalityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  recordSubMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  distPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  distPillGreen: {
    backgroundColor: '#DCFCE7',
  },
  distPillGray: {
    backgroundColor: '#F1F5F9',
  },
  distPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  distPillTextGreen: {
    color: '#15803D',
  },
  distPillTextGray: {
    color: '#64748B',
  },
  recordRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  recordCentRate: {
    fontSize: 14,
    fontWeight: '800',
    color: '#240046',
  },
  recordSqFtRate: {
    fontSize: 11,
    color: '#64748B',
  },
  recordTotalPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  recordArea: {
    fontSize: 10,
    color: '#64748B',
  },
  recordBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sourceTag: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  sourceTagGreen: {
    backgroundColor: '#DCFCE7',
  },
  sourceTagBlue: {
    backgroundColor: '#DBEAFE',
  },
  sourceTagAmber: {
    backgroundColor: '#FEF3C7',
  },
  sourceTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sourceTagTextGreen: {
    color: '#15803D',
  },
  sourceTagTextBlue: {
    color: '#1D4ED8',
  },
  sourceTagTextAmber: {
    color: '#B45309',
  },
  usageTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  usageTagText: {
    fontSize: 10,
    color: '#475569',
  },
  recordDateText: {
    fontSize: 10,
    color: '#94A3B8',
  },

  /* Guideline & Methodology */
  guidelineHubCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  guidelineHubTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guidelineHubName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  guidelineHubDistrict: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  guidelineHubRate: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E40AF',
  },
  guidelineHubUnit: {
    fontSize: 10,
    color: '#64748B',
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
    backgroundColor: '#240046',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A0033',
  },
  stepDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
});
