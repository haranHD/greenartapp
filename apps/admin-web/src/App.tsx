import React, { useState, useEffect, useRef } from 'react';
import {
  api,
  ApiLandRecord,
  LocalityReference,
  EstimateApiResponse,
  BatchImportSummaryResponse,
  ValidatedRecordPreview,
  ImportBatchRecord,
  StatewideCoverageSummary,
  MlReadinessAuditReport,
  ProviderSummary,
  HealthCheckResponse,
} from './services/api';

// =========================================================================
// Clean Professional SVG Line Icons (No emojis)
// =========================================================================
const Icons = {
  Dashboard: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  Map: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  ),
  Records: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  Upload: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  Globe: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  Book: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Pin: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Refresh: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  Plus: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Download: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Key: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Alert: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
};

type TabView = 'dashboard' | 'explorer' | 'records' | 'import' | 'statewide' | 'methodology';

export const App = () => {
  const [activeTab, setActiveTab] = useState<TabView>('dashboard');

  // Backend Health & Database Connectivity
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [isApiConnected, setIsApiConnected] = useState<boolean>(false);

  // Target Location for Estimation & Explorer
  const [targetLat, setTargetLat] = useState<number>(11.0012);
  const [targetLng, setTargetLng] = useState<number>(77.0874);
  const [selectedLocality, setSelectedLocality] = useState<string>('Kannampalayam');
  const [selectedUsage, setSelectedUsage] = useState<string>('Residential');
  const [radiusMeters] = useState<number>(1000);
  const [locationSearchQuery, setLocationSearchQuery] = useState<string>('Kannampalayam');
  const [showLocationSuggestions, setShowLocationSuggestions] = useState<boolean>(false);

  // Database Records & Reference Localities
  const [localities, setLocalities] = useState<LocalityReference[]>([]);
  const [records, setRecords] = useState<ApiLandRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);
  const [errorRecords, setErrorRecords] = useState<string | null>(null);

  // Live Spatial Valuation Estimate
  const [estimate, setEstimate] = useState<EstimateApiResponse | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState<boolean>(false);
  const [errorEstimate, setErrorEstimate] = useState<string | null>(null);

  // Filters for Registry Tab
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [filterLocality, setFilterLocality] = useState<string>('All');
  const [filterSource, setFilterSource] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterUsage, setFilterUsage] = useState<string>('All');

  // Add Record Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isSubmittingRecord, setIsSubmittingRecord] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [addFormData, setAddFormData] = useState({
    country: 'India',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    taluk: 'Sulur',
    locality: 'Kannampalayam',
    streetOrLandmark: '',
    surveyNumber: '',
    latitude: 11.0012,
    longitude: 77.0874,
    landUsage: 1, // Residential
    area: 4.0,
    unit: 2, // Cent
    price: 4500000,
    sourceCategory: 2, // VerifiedTransaction
    sourceReference: 'Deed audit reference',
    notes: 'Verified field entry',
  });

  // Notifications
  const [notification, setNotification] = useState<string | null>(null);

  // Admin Key Management (Stored in sessionStorage; never bundled)
  const [adminKey, setAdminKey] = useState<string>(() => api.getAdminKey());
  const [isAdminKeyModalOpen, setIsAdminKeyModalOpen] = useState<boolean>(false);
  const [adminKeyInput, setAdminKeyInput] = useState<string>('');

  // Record Moderation / Verification Modal State
  const [moderationRecord, setModerationRecord] = useState<ApiLandRecord | null>(null);
  const [moderationTargetStatus, setModerationTargetStatus] = useState<number>(2); // Default to Verified
  const [moderationAuditNote, setModerationAuditNote] = useState<string>('');
  const [isSubmittingModeration, setIsSubmittingModeration] = useState<boolean>(false);

  // CSV Import State
  const [selectedCsvFile, setSelectedCsvFile] = useState<File | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [isAnalyzingCsv, setIsAnalyzingCsv] = useState<boolean>(false);
  const [isExecutingImport, setIsExecutingImport] = useState<boolean>(false);
  const [csvSummary, setCsvSummary] = useState<BatchImportSummaryResponse | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState<boolean>(false);
  const [importConfirmAcknowledged, setImportConfirmAcknowledged] = useState<boolean>(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [showSchemaGuide, setShowSchemaGuide] = useState<boolean>(false);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'duplicate' | 'invalid'>('all');
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [previewPage, setPreviewPage] = useState<number>(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Statewide Coverage & ML Readiness
  const [importHistory, setImportHistory] = useState<ImportBatchRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [coverageSummary, setCoverageSummary] = useState<StatewideCoverageSummary | null>(null);
  const [loadingCoverage, setLoadingCoverage] = useState<boolean>(false);
  const [mlReport, setMlReport] = useState<MlReadinessAuditReport | null>(null);
  const [loadingMlReport, setLoadingMlReport] = useState<boolean>(false);
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loadingProviders, setLoadingProviders] = useState<boolean>(false);
  const [statewideFilterDistrict, setStatewideFilterDistrict] = useState<string>('');
  const [statewideFilterStatus, setStatewideFilterStatus] = useState<string>('All');

  // Map DOM & Leaflet Instance References
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);

  // Helper Mappings
  function getLandUsageInt(usage: string): number {
    switch (usage) {
      case 'Residential': return 1;
      case 'Commercial': return 2;
      case 'AgriculturalWet':
      case 'Agricultural': return 3;
      case 'AgriculturalDry': return 4;
      case 'Industrial': return 5;
      case 'MixedUse': return 6;
      default: return 1;
    }
  }

  function getSourceCategoryInt(src: string): number {
    switch (src) {
      case 'GovernmentGuideline': return 1;
      case 'VerifiedTransaction': return 2;
      case 'AdvertisedAskingPrice': return 3;
      case 'ClientResearch': return 4;
      case 'SyntheticFixture': return 5;
      default: return 0;
    }
  }

  // 1. Initial Health Check & Reference Data Loading
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const h = await api.getHealth();
        setHealth(h);
        setIsApiConnected(h.status === 'Healthy' && h.database?.connected === true);
      } catch {
        setIsApiConnected(false);
      }
    };

    const loadLocalities = async () => {
      try {
        const locs = await api.getReferenceLocalities();
        setLocalities(locs);
      } catch (err: any) {
        console.error('Failed to load reference localities:', err);
      }
    };

    checkHealth();
    loadLocalities();
  }, []);

  // 2. Fetch Land Records from PostgreSQL
  const fetchRecords = React.useCallback(async () => {
    setLoadingRecords(true);
    setErrorRecords(null);
    try {
      const data = await api.getLandRecords(
        filterLocality !== 'All' ? filterLocality : undefined,
        filterUsage !== 'All' ? getLandUsageInt(filterUsage) : undefined,
        filterSource !== 'All' ? getSourceCategoryInt(filterSource) : undefined
      );
      setRecords(data);
    } catch (err: any) {
      setErrorRecords(err.message || 'Failed to load land records from database.');
    } finally {
      setLoadingRecords(false);
    }
  }, [filterLocality, filterUsage, filterSource]);

  const fetchImportHistory = React.useCallback(async () => {
    setLoadingHistory(true);
    try {
      const history = await api.getImportHistory(20);
      setImportHistory(history);
    } catch (err: any) {
      console.error('Failed to load import history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const fetchStatewideData = React.useCallback(async () => {
    setLoadingCoverage(true);
    setLoadingMlReport(true);
    setLoadingProviders(true);
    try {
      const [cov, ml, prov] = await Promise.all([
        api.getCoverageSummary(),
        api.getMlReadiness(),
        api.getProviders(),
      ]);
      setCoverageSummary(cov);
      setMlReport(ml);
      setProviders(prov);
    } catch (err: any) {
      console.error('Failed to load statewide coverage or ML readiness data:', err);
    } finally {
      setLoadingCoverage(false);
      setLoadingMlReport(false);
      setLoadingProviders(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    if (activeTab === 'import') {
      fetchImportHistory();
    } else if (activeTab === 'statewide' || activeTab === 'dashboard') {
      fetchStatewideData();
    }
  }, [activeTab, fetchImportHistory, fetchStatewideData]);

  // 3. Fetch Spatial Valuation from PostGIS Backend
  const fetchEstimate = React.useCallback(async (lat: number, lng: number, usage: string) => {
    setLoadingEstimate(true);
    setErrorEstimate(null);
    try {
      const usageInt = getLandUsageInt(usage);
      const est = await api.calculateEstimate(lat, lng, usageInt, radiusMeters);
      setEstimate(est);
    } catch (err: any) {
      setErrorEstimate(err.message || 'Unable to compute spatial valuation.');
      setEstimate(null);
    } finally {
      setLoadingEstimate(false);
    }
  }, [radiusMeters]);

  // Re-fetch estimate whenever target coordinate or usage changes
  useEffect(() => {
    if (activeTab === 'explorer') {
      fetchEstimate(targetLat, targetLng, selectedUsage);
    }
  }, [activeTab, targetLat, targetLng, selectedUsage, fetchEstimate]);

  // 4. Interactive Leaflet Map Cockpit Setup
  useEffect(() => {
    if (activeTab !== 'explorer') return;

    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current).setView([targetLat, targetLng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors & Greenart Properties',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);

      // Click on map to place custom target coordinate
      mapInstanceRef.current.on('click', (e: any) => {
        const clickedLat = Math.round(e.latlng.lat * 10000) / 10000;
        const clickedLng = Math.round(e.latlng.lng * 10000) / 10000;
        setTargetLat(clickedLat);
        setTargetLng(clickedLng);
        setSelectedLocality('Custom Pin');
        setLocationSearchQuery('');
        setShowLocationSuggestions(false);
      });
    } else {
      mapInstanceRef.current.setView([targetLat, targetLng], 15);
      mapInstanceRef.current.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.Circle) {
          mapInstanceRef.current.removeLayer(layer);
        }
      });
    }

    // Invalidate size to ensure full container fill
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 100);

    const map = mapInstanceRef.current;

    // Target Estimation Center Pin (Royal Violet with Gold Accent)
    const targetIcon = L.divIcon({
      className: 'target-pin-icon',
      html: `<div style="background:#240046;color:#ffffff;border:2px solid #d4af37;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,0.3);">PIN</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    L.marker([targetLat, targetLng], { icon: targetIcon, title: `Target Location: ${selectedLocality}` })
      .addTo(map)
      .bindPopup(`<strong>Target Location: ${selectedLocality}</strong><br/>Search Radius: ${radiusMeters}m`);

    // 1,000-Metre PostGIS Geodesic Buffer Circle
    L.circle([targetLat, targetLng], {
      radius: radiusMeters,
      color: '#d4af37',
      fillColor: '#d4af37',
      fillOpacity: 0.1,
      weight: 1.5,
    }).addTo(map);

    // Plot nearby comparable records
    records.forEach((r) => {
      let markerColor = '#16a34a'; // VerifiedTransaction
      if (r.sourceCategory === 'GovernmentGuideline') markerColor = '#2563eb';
      else if (r.sourceCategory === 'AdvertisedAskingPrice') markerColor = '#ea580c';
      else if (r.sourceCategory === 'ClientResearch') markerColor = '#7e22ce';

      const dotIcon = L.divIcon({
        className: 'record-dot-icon',
        html: `<div style="background:${markerColor};border:1.5px solid #ffffff;border-radius:50%;width:12px;height:12px;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      L.marker([r.latitude, r.longitude], { icon: dotIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-size:0.8125rem;">
            <strong>${r.locality}</strong> (${r.landUsage})<br/>
            Rate: <strong>₹${(r.normalizedRatePerCent / 100000).toFixed(2)}L / Cent</strong> (₹${r.normalizedRatePerSqFt}/sq.ft)<br/>
            Source: ${r.sourceCategory}<br/>
            Status: ${r.verificationStatus}
          </div>
        `);
    });
  }, [activeTab, targetLat, targetLng, radiusMeters, selectedLocality, records]);

  const handleSelectPilotLocality = (loc: string, lat: number, lng: number) => {
    setSelectedLocality(loc);
    setTargetLat(lat);
    setTargetLng(lng);
    if (loc !== 'Custom Pin' && loc !== 'Sparse Sector') {
      setLocationSearchQuery(loc);
    }
    setShowLocationSuggestions(false);
  };

  // Location suggestions filtered by search query
  const filteredLocalitySuggestions: LocalityReference[] = React.useMemo(() => {
    if (!locationSearchQuery.trim()) return [];
    const q = locationSearchQuery.toLowerCase();
    return localities.filter(
      (loc: LocalityReference) => loc.name.toLowerCase().includes(q) || loc.district.toLowerCase().includes(q)
    );
  }, [locationSearchQuery, localities]);

  const handleSelectSuggestion = (loc: LocalityReference) => {
    handleSelectPilotLocality(loc.name, loc.latitude, loc.longitude);
  };

  const handleLocationSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationSearchQuery.trim()) return;

    // Check if coordinates entered: e.g. "11.0012, 77.0874"
    const coordMatch = locationSearchQuery.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[3]);
      if (lat >= 8.0 && lat <= 14.0 && lng >= 76.0 && lng <= 81.0) {
        setTargetLat(Math.round(lat * 10000) / 10000);
        setTargetLng(Math.round(lng * 10000) / 10000);
        setSelectedLocality('Custom Pin');
        setShowLocationSuggestions(false);
        return;
      }
    }

    // Match by locality name
    const match = localities.find(l => l.name.toLowerCase() === locationSearchQuery.trim().toLowerCase())
      || localities.find(l => l.name.toLowerCase().includes(locationSearchQuery.trim().toLowerCase()));
    if (match) {
      handleSelectPilotLocality(match.name, match.latitude, match.longitude);
    }
    setShowLocationSuggestions(false);
  };

  // 5. Audit & Moderation Action Handlers
  const handleOpenModerationModal = (record: ApiLandRecord, targetStatus: number) => {
    setModerationRecord(record);
    setModerationTargetStatus(targetStatus);
    const defaultNote =
      targetStatus === 2 ? 'Verified against official land deed and survey records.' :
        targetStatus === 1 ? 'Pending physical survey and secondary title verification.' :
          targetStatus === 3 ? 'Rejected by administrative audit (disputed boundary / outlier pricing).' :
            'Archived historical land record.';
    setModerationAuditNote(defaultNote);
  };

  const handleConfirmModeration = async () => {
    if (!moderationRecord) return;
    setIsSubmittingModeration(true);
    try {
      await api.updateVerificationStatus(moderationRecord.id, moderationTargetStatus, moderationAuditNote);
      const statusLabels: Record<number, string> = {
        1: 'Pending Review',
        2: 'Verified',
        3: 'Rejected',
        4: 'Archived',
      };
      setNotification(`Record verification status updated to ${statusLabels[moderationTargetStatus] || 'Updated'}.`);
      setTimeout(() => setNotification(null), 4000);
      setModerationRecord(null);
      await fetchRecords();
      if (activeTab === 'explorer') {
        await fetchEstimate(targetLat, targetLng, selectedUsage);
      }
    } catch (err: any) {
      alert(`Moderation Error: ${err.message}`);
    } finally {
      setIsSubmittingModeration(false);
    }
  };

  // 6. Manual Record Submission Handler
  const handleCreateRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingRecord(true);
    setSubmitError(null);

    try {
      await api.createLandRecord({
        locality: addFormData.locality,
        taluk: addFormData.taluk || undefined,
        streetOrLandmark: addFormData.streetOrLandmark || undefined,
        surveyNumber: addFormData.surveyNumber || undefined,
        latitude: addFormData.latitude,
        longitude: addFormData.longitude,
        landUsage: addFormData.landUsage,
        area: addFormData.area,
        unit: addFormData.unit,
        price: addFormData.price,
        sourceCategory: addFormData.sourceCategory,
        sourceReference: addFormData.sourceReference || undefined,
        notes: addFormData.notes || undefined,
      });

      setIsAddModalOpen(false);
      setNotification('New land record created successfully.');
      setTimeout(() => setNotification(null), 4000);

      await fetchRecords();
      if (activeTab === 'explorer') {
        await fetchEstimate(targetLat, targetLng, selectedUsage);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to persist land record.');
    } finally {
      setIsSubmittingRecord(false);
    }
  };

  // 7. CSV Upload & Preview Handlers
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvError('Invalid file format. Please upload a standard RFC 4180 CSV file (.csv).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setCsvError('File exceeds the maximum allowed size limit of 5 MB.');
      return;
    }

    setSelectedCsvFile(file);
    setIsAnalyzingCsv(true);
    setCsvError(null);
    setImportSuccessMessage(null);
    setPreviewPage(1);

    try {
      const previewSummary = await api.importCsv(file, true, skipDuplicates, adminKey);
      setCsvSummary(previewSummary);
    } catch (err: any) {
      if (err.status === 401 || err.message?.includes('401') || err.message?.toLowerCase().includes('unauthorized')) {
        setCsvError('Unauthorized: A valid Admin API Key is required. Click "Set Admin Key" in the top bar to provide it.');
        setIsAdminKeyModalOpen(true);
      } else {
        setCsvError(err.message || 'Failed to validate and preview CSV file.');
      }
      setCsvSummary(null);
    } finally {
      setIsAnalyzingCsv(false);
    }
  };

  const handleToggleSkipDuplicates = async (newVal: boolean) => {
    setSkipDuplicates(newVal);
    if (selectedCsvFile) {
      setIsAnalyzingCsv(true);
      try {
        const previewSummary = await api.importCsv(selectedCsvFile, true, newVal, adminKey);
        setCsvSummary(previewSummary);
      } catch (err: any) {
        setCsvError(err.message || 'Failed to re-analyze CSV file.');
      } finally {
        setIsAnalyzingCsv(false);
      }
    }
  };

  const handleExecuteImport = async () => {
    if (!selectedCsvFile) return;

    setIsExecutingImport(true);
    setCsvError(null);
    setIsImportConfirmOpen(false);

    try {
      const summary = await api.importCsv(selectedCsvFile, false, skipDuplicates, adminKey);
      setCsvSummary(summary);
      setImportSuccessMessage(
        `Batch Ingestion Completed: ${summary.importedRows} records imported. ${summary.skippedRows} duplicates skipped.`
      );

      // Refresh records, history, and localities
      await fetchRecords();
      await fetchImportHistory();
      if (coverageSummary) {
        fetchStatewideData();
      }
      try {
        const locs = await api.getReferenceLocalities();
        setLocalities(locs);
      } catch {
        // Suppress reference localities error if offline
      }
    } catch (err: any) {
      if (err.status === 401 || err.message?.includes('401') || err.message?.toLowerCase().includes('unauthorized')) {
        setCsvError('Unauthorized: Ingestion requires a valid Admin API Key. Please configure your admin key.');
        setIsAdminKeyModalOpen(true);
      } else {
        setCsvError(err.message || 'Failed to complete batch ingestion.');
      }
    } finally {
      setIsExecutingImport(false);
    }
  };

  const handleResetCsv = () => {
    setSelectedCsvFile(null);
    setCsvSummary(null);
    setCsvError(null);
    setImportSuccessMessage(null);
    setPreviewPage(1);
    setPreviewSearch('');
    setPreviewFilter('all');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Real Analytics Metrics Derived from Existing Records
  const analytics = React.useMemo(() => {
    const total = records.length;
    const verified = records.filter(r => r.verificationStatus === 'Verified').length;
    const pendingReview = records.filter(r => r.verificationStatus === 'PendingReview').length;
    const unverified = records.filter(r => r.verificationStatus === 'Unverified').length;
    const rejected = records.filter(r => r.verificationStatus === 'Rejected').length;
    const archived = records.filter(r => r.verificationStatus === 'Archived').length;

    const bySource = {
      VerifiedTransaction: records.filter(r => r.sourceCategory === 'VerifiedTransaction').length,
      GovernmentGuideline: records.filter(r => r.sourceCategory === 'GovernmentGuideline').length,
      AdvertisedAskingPrice: records.filter(r => r.sourceCategory === 'AdvertisedAskingPrice').length,
      ClientResearch: records.filter(r => r.sourceCategory === 'ClientResearch').length,
    };

    const byUsage = {
      Residential: records.filter(r => r.landUsage === 'Residential').length,
      Commercial: records.filter(r => r.landUsage === 'Commercial').length,
      Agricultural: records.filter(r => r.landUsage.startsWith('Agricultural')).length,
      Industrial: records.filter(r => r.landUsage === 'Industrial').length,
      MixedUse: records.filter(r => r.landUsage === 'MixedUse').length,
    };

    return { total, verified, pendingReview, unverified, rejected, archived, bySource, byUsage };
  }, [records]);

  // Filtered Records for Registry Table
  const filteredRecords = React.useMemo(() => {
    return records.filter((r: ApiLandRecord) => {
      const matchSearch = !filterSearch ||
        r.locality.toLowerCase().includes(filterSearch.toLowerCase()) ||
        (r.surveyNumber && r.surveyNumber.toLowerCase().includes(filterSearch.toLowerCase())) ||
        (r.streetOrLandmark && r.streetOrLandmark.toLowerCase().includes(filterSearch.toLowerCase())) ||
        r.district.toLowerCase().includes(filterSearch.toLowerCase());

      const matchLocality = filterLocality === 'All' || r.locality.toLowerCase() === filterLocality.toLowerCase();
      const matchStatus = filterStatus === 'All' || r.verificationStatus === filterStatus;
      const matchSource = filterSource === 'All' || r.sourceCategory === filterSource;
      const matchUsage = filterUsage === 'All' || r.landUsage === filterUsage || (filterUsage === 'Agricultural' && r.landUsage.startsWith('Agricultural'));

      return matchSearch && matchLocality && matchStatus && matchSource && matchUsage;
    });
  }, [records, filterSearch, filterLocality, filterStatus, filterSource, filterUsage]);

  // Previews filtering and pagination for CSV Import Tab
  const filteredPreviews = React.useMemo(() => {
    if (!csvSummary || !csvSummary.previews) return [];
    return csvSummary.previews.filter((p: ValidatedRecordPreview) => {
      if (previewFilter === 'valid' && (!p.isValid || p.isDuplicate)) return false;
      if (previewFilter === 'duplicate' && !p.isDuplicate) return false;
      if (previewFilter === 'invalid' && p.isValid) return false;
      if (previewSearch.trim()) {
        const query = previewSearch.toLowerCase();
        const loc = (p.locality || '').toLowerCase();
        const srv = (p.surveyNumber || '').toLowerCase();
        const tlk = (p.taluk || '').toLowerCase();
        const usg = (p.landUsage || '').toLowerCase();
        if (!loc.includes(query) && !srv.includes(query) && !tlk.includes(query) && !usg.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [csvSummary, previewFilter, previewSearch]);

  const previewPageSize = 10;
  const totalPreviewPages = Math.max(1, Math.ceil(filteredPreviews.length / previewPageSize));
  const paginatedPreviews = React.useMemo(() => {
    const start = (previewPage - 1) * previewPageSize;
    return filteredPreviews.slice(start, start + previewPageSize);
  }, [filteredPreviews, previewPage, previewPageSize]);

  return (
    <div className="workspace-layout">
      {/* =========================================================================
          SIDEBAR NAVIGATION
          ========================================================================= */}
      <aside className="app-sidebar">
        <div className="sidebar-brand-card">
          <div className="logo-container">
            <img src="/logo.png" alt="Greenart Properties Logo" className="brand-logo-img" />
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span className="nav-icon"><Icons.Dashboard /></span>
            <span>Dashboard</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'explorer' ? 'active' : ''}`}
            onClick={() => setActiveTab('explorer')}
          >
            <span className="nav-icon"><Icons.Map /></span>
            <span>Land Price Explorer</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'records' ? 'active' : ''}`}
            onClick={() => setActiveTab('records')}
          >
            <span className="nav-icon"><Icons.Records /></span>
            <span>Land Records</span>
            <span className="nav-badge">{records.length}</span>
          </button>

          <div className="nav-divider"></div>

          <button
            className={`nav-item ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            <span className="nav-icon"><Icons.Upload /></span>
            <span>CSV Import</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'statewide' ? 'active' : ''}`}
            onClick={() => setActiveTab('statewide')}
          >
            <span className="nav-icon"><Icons.Globe /></span>
            <span>Statewide Coverage</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'methodology' ? 'active' : ''}`}
            onClick={() => setActiveTab('methodology')}
          >
            <span className="nav-icon"><Icons.Book /></span>
            <span>Valuation Methodology</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="system-status-indicator">
            <span className={isApiConnected ? 'status-dot-pulse' : 'status-dot-offline'}></span>
            <span>{isApiConnected ? 'System Online' : 'Service Offline'}</span>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          MAIN APPLICATION WORKSPACE
          ========================================================================= */}
      <div className="app-main">
        {/* Top App Bar */}
        <header className="app-topbar">
          <div className="topbar-left">
            <span className="page-title">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'explorer' && 'Land Price Explorer'}
              {activeTab === 'records' && 'Land Records Registry'}
              {activeTab === 'import' && 'Batch CSV Import'}
              {activeTab === 'statewide' && 'Statewide Coverage'}
              {activeTab === 'methodology' && 'Valuation Methodology'}
            </span>
          </div>

          <div className="topbar-right">
            <div className="topbar-search-box">
              <Icons.Search />
              <input
                type="text"
                className="topbar-search-input"
                placeholder="Search location or survey..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
              />
            </div>

            <button
              className="btn btn-sm"
              onClick={() => {
                setAdminKeyInput(adminKey);
                setIsAdminKeyModalOpen(true);
              }}
              style={{
                background: adminKey ? '#f0fdf4' : '#fef2f2',
                color: adminKey ? '#166534' : '#991b1b',
                border: adminKey ? '1px solid #bbf7d0' : '1px solid #fecaca',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.75rem',
                padding: '4px 8px',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
              title="Configure Administrative API Key for Ingestion & Verification"
            >
              <Icons.Key />
              <span>{adminKey ? 'Admin Key Set' : 'Set Admin Key'}</span>
            </button>

            <div className="user-profile-badge">
              <div className="user-avatar">GA</div>
              <div className="user-info">
                <span className="user-name">Greenart Analyst</span>
                <span className="user-role">Administrator</span>
              </div>
            </div>
          </div>
        </header>

        {/* Global Notifications */}
        {notification && (
          <div className="content-body" style={{ paddingBottom: 0 }}>
            <div className="flash-banner flash-success">
              <span>{notification}</span>
              <button
                onClick={() => setNotification(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: '#166534' }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <main className="content-body">
          {/* =====================================================================
              VIEW 1: EXECUTIVE DASHBOARD
              ===================================================================== */}
          {activeTab === 'dashboard' && (
            <div>
              {/* Restrained KPI Grid */}
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Total Land Records</span>
                  </div>
                  <div className="kpi-value">{records.length}</div>
                  <div className="kpi-footer">
                    <span>Database total records</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Verified Records</span>
                  </div>
                  <div className="kpi-value" style={{ color: '#166534' }}>{analytics.verified}</div>
                  <div className="kpi-footer">
                    <span>{records.length > 0 ? `${((analytics.verified / records.length) * 100).toFixed(0)}%` : '0%'} of total records</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Pending Moderation</span>
                  </div>
                  <div className="kpi-value" style={{ color: '#92400e' }}>{analytics.unverified}</div>
                  <div className="kpi-footer">
                    <span>Unverified records awaiting audit</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Active Districts</span>
                  </div>
                  <div className="kpi-value">{coverageSummary ? `${coverageSummary.activeDistrictsCount} / 38` : '1 / 38'}</div>
                  <div className="kpi-footer">
                    <span>Coimbatore pilot hub active</span>
                  </div>
                </div>
              </div>

              {/* Distribution Analytics Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                {/* Source Category Breakdown */}
                <div className="panel-card">
                  <div className="panel-card-header">
                    <div>
                      <h3>Source Distribution</h3>
                      <div className="panel-card-subtitle">Breakdown by record evidence category</div>
                    </div>
                  </div>
                  <div className="panel-card-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 500 }}>Registered Sale Deeds (Verified)</span>
                          <strong>{analytics.bySource.VerifiedTransaction}</strong>
                        </div>
                        <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${records.length > 0 ? (analytics.bySource.VerifiedTransaction / records.length) * 100 : 0}%`,
                            height: '100%',
                            background: '#166534'
                          }}></div>
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 500 }}>Statutory Guideline Values</span>
                          <strong>{analytics.bySource.GovernmentGuideline}</strong>
                        </div>
                        <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${records.length > 0 ? (analytics.bySource.GovernmentGuideline / records.length) * 100 : 0}%`,
                            height: '100%',
                            background: '#1d4ed8'
                          }}></div>
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 500 }}>Advertised Asking Prices</span>
                          <strong>{analytics.bySource.AdvertisedAskingPrice}</strong>
                        </div>
                        <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${records.length > 0 ? (analytics.bySource.AdvertisedAskingPrice / records.length) * 100 : 0}%`,
                            height: '100%',
                            background: '#c2410c'
                          }}></div>
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 500 }}>Field Surveyor Research</span>
                          <strong>{analytics.bySource.ClientResearch}</strong>
                        </div>
                        <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${records.length > 0 ? (analytics.bySource.ClientResearch / records.length) * 100 : 0}%`,
                            height: '100%',
                            background: '#581c87'
                          }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Land Classification Split */}
                <div className="panel-card">
                  <div className="panel-card-header">
                    <div>
                      <h3>Zoning Classification</h3>
                      <div className="panel-card-subtitle">Distribution across land usage classifications</div>
                    </div>
                  </div>
                  <div className="panel-card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>RESIDENTIAL</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>{analytics.byUsage.Residential}</div>
                      </div>

                      <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>COMMERCIAL</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>{analytics.byUsage.Commercial}</div>
                      </div>

                      <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>AGRICULTURAL</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>{analytics.byUsage.Agricultural}</div>
                      </div>

                      <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>INDUSTRIAL / OTHER</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>{analytics.byUsage.Industrial + analytics.byUsage.MixedUse}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fast Pilot Corridors Jump Row */}
              <div className="panel-card">
                <div className="panel-card-header">
                  <div>
                    <h3>Pilot Localities</h3>
                    <div className="panel-card-subtitle">Verified reference locations in Coimbatore corridor</div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => setActiveTab('explorer')}>
                    Open Explorer
                  </button>
                </div>
                <div className="panel-card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                    {localities.map((loc) => (
                      <div
                        key={loc.name}
                        style={{
                          padding: '1rem',
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          handleSelectPilotLocality(loc.name, loc.latitude, loc.longitude);
                          setActiveTab('explorer');
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>{loc.name}</span>
                          <span className="badge badge-purple">{loc.recordCount} Records</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.35rem' }}>
                          {loc.district} • {loc.latitude.toFixed(3)}, {loc.longitude.toFixed(3)}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: '#166534', fontWeight: 600 }}>
                          Guideline: ₹{(loc.guidelineRatePerCent / 100000).toFixed(2)}L / Cent
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Activity Feed */}
              <div className="panel-card">
                <div className="panel-card-header">
                  <div>
                    <h3>Recent Land Records</h3>
                    <div className="panel-card-subtitle">Latest observations recorded in database</div>
                  </div>
                  <button className="btn btn-sm btn-secondary" onClick={() => setActiveTab('records')}>
                    View All ({records.length})
                  </button>
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Locality</th>
                        <th>Survey Number</th>
                        <th>Coordinates</th>
                        <th>Classification</th>
                        <th>Area</th>
                        <th>Normalized Rate</th>
                        <th>Source</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.slice(0, 6).map((r) => (
                        <tr key={r.id}>
                          <td><strong>{r.locality}</strong>, {r.district}</td>
                          <td><code>{r.surveyNumber || '—'}</code></td>
                          <td><small>{r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}</small></td>
                          <td>{r.landUsage}</td>
                          <td>{r.originalArea} {r.originalUnit}</td>
                          <td><strong>₹{(r.normalizedRatePerCent / 100000).toFixed(2)}L / Cent</strong></td>
                          <td>
                            <span className={
                              r.sourceCategory === 'VerifiedTransaction' ? 'badge badge-green' :
                                r.sourceCategory === 'GovernmentGuideline' ? 'badge badge-blue' :
                                  r.sourceCategory === 'AdvertisedAskingPrice' ? 'badge badge-orange' : 'badge badge-purple'
                            }>
                              {r.sourceCategory}
                            </span>
                          </td>
                          <td>
                            <span className={r.verificationStatus === 'Verified' ? 'badge badge-green' : 'badge badge-gold'}>
                              {r.verificationStatus}
                            </span>
                          </td>
                          <td><small>{new Date(r.observationDate).toLocaleDateString()}</small></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* System & GIS Diagnostics (Operational admin diagnostics moved out of customer-facing explorer) */}
              <div className="panel-card" style={{ marginTop: '1.25rem' }}>
                <div className="panel-card-header">
                  <div>
                    <h3>System & GIS Diagnostics</h3>
                    <div className="panel-card-subtitle">Operational infrastructure configuration and spatial engine state</div>
                  </div>
                  <span className={`badge ${isApiConnected ? 'badge-green' : 'badge-gold'}`}>
                    {isApiConnected ? 'PostGIS Active' : 'Offline'}
                  </span>
                </div>
                <div className="panel-card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                    <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>POSTGIS VERSION</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{health?.database?.postgisVersion || 'PostGIS 3.4'}</div>
                    </div>
                    <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>SPATIAL REFERENCE</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>EPSG:4326 (WGS 84)</div>
                    </div>
                    <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>SEARCH BUFFER</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>1,000m Geodesic</div>
                    </div>
                    <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>ESTIMATION ALGORITHM</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Median & IQR Outlier Rejection</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              VIEW 2: LAND PRICE EXPLORER
              ===================================================================== */}
          {activeTab === 'explorer' && (
            <div>
              {/* Compact Searchable Location Toolbar */}
              <div className="explorer-toolbar">
                <div className="explorer-toolbar-top">
                  {/* Searchable Location Control with Autocomplete */}
                  <div className="location-search-wrapper">
                    <form onSubmit={handleLocationSearchSubmit} className="location-search-form">
                      <span style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
                        <Icons.Search />
                      </span>
                      <input
                        type="text"
                        className="location-search-input"
                        placeholder="Search locality, taluk, or coordinates in Tamil Nadu..."
                        value={locationSearchQuery}
                        onChange={(e) => {
                          setLocationSearchQuery(e.target.value);
                          setShowLocationSuggestions(true);
                        }}
                        onFocus={() => setShowLocationSuggestions(true)}
                      />
                      {locationSearchQuery && (
                        <button
                          type="button"
                          className="clear-search-btn"
                          onClick={() => {
                            setLocationSearchQuery('');
                            setShowLocationSuggestions(false);
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </form>

                    {showLocationSuggestions && filteredLocalitySuggestions.length > 0 && (
                      <div className="location-suggestions-dropdown">
                        {filteredLocalitySuggestions.map((loc: LocalityReference) => (
                          <div
                            key={loc.name}
                            className="suggestion-item"
                            onClick={() => handleSelectSuggestion(loc)}
                          >
                            <div className="suggestion-name">{loc.name}</div>
                            <div className="suggestion-meta">{loc.district} • {loc.recordCount} records</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Compact Locality Dropdown Selector */}
                  <div className="toolbar-group">
                    <label className="toolbar-label">Locality:</label>
                    <select
                      className="select-input"
                      value={selectedLocality}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Sparse Sector') {
                          handleSelectPilotLocality('Sparse Sector', 11.15, 77.20);
                          setLocationSearchQuery('');
                        } else {
                          const loc = localities.find(l => l.name === val);
                          if (loc) {
                            handleSelectPilotLocality(loc.name, loc.latitude, loc.longitude);
                            setLocationSearchQuery(loc.name);
                          }
                        }
                      }}
                    >
                      {localities.map((loc) => (
                        <option key={loc.name} value={loc.name}>
                          {loc.name} ({loc.district}) — {loc.recordCount} records
                        </option>
                      ))}
                      <option value="Sparse Sector">Sparse Sector (Out-of-Pilot Test)</option>
                      {selectedLocality === 'Custom Pin' && (
                        <option value="Custom Pin">Custom Map Pin ({targetLat.toFixed(4)}, {targetLng.toFixed(4)})</option>
                      )}
                    </select>
                  </div>

                  {/* Zoning Classification Dropdown */}
                  <div className="toolbar-group">
                    <label className="toolbar-label">Zoning:</label>
                    <select
                      className="select-input"
                      value={selectedUsage}
                      onChange={(e) => setSelectedUsage(e.target.value)}
                    >
                      <option value="Residential">Residential</option>
                      <option value="Commercial">Commercial</option>
                      <option value="Agricultural">Agricultural</option>
                      <option value="Industrial">Industrial</option>
                      <option value="MixedUse">Mixed-Use</option>
                    </select>
                  </div>
                </div>

                {/* Quick-Location Shortcuts (Less Prominent Form) */}
                <div className="explorer-toolbar-shortcuts">
                  <span className="shortcuts-label">Quick select:</span>
                  <div className="shortcuts-pills">
                    {localities.map((loc) => (
                      <button
                        key={loc.name}
                        type="button"
                        className={`shortcut-chip ${selectedLocality === loc.name ? 'active' : ''}`}
                        onClick={() => {
                          handleSelectPilotLocality(loc.name, loc.latitude, loc.longitude);
                          setLocationSearchQuery(loc.name);
                        }}
                      >
                        {loc.name}
                        <span className="shortcut-chip-count">{loc.recordCount}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`shortcut-chip ${selectedLocality === 'Sparse Sector' ? 'active' : ''}`}
                      onClick={() => {
                        handleSelectPilotLocality('Sparse Sector', 11.15, 77.20);
                        setLocationSearchQuery('');
                      }}
                    >
                      Out-of-Pilot (Test)
                    </button>
                  </div>
                </div>
              </div>

              {/* 2-Column Explorer Cockpit */}
              <div className="explorer-grid">
                {/* Left Column: Interactive GIS Leaflet Map */}
                <div className="map-viewport-card">
                  <div className="map-card-header">
                    <div className="map-header-left">
                      <h3 className="map-title">Interactive Map</h3>
                      <span className="map-subtitle">
                        1,000m radius • Click anywhere to reposition pin
                      </span>
                    </div>
                    <div className="map-header-right">
                      <span className="map-coordinate-text">
                        {targetLat.toFixed(4)}° N, {targetLng.toFixed(4)}° E
                      </span>
                      <span className="map-radius-tag">1 km Radius</span>
                    </div>
                  </div>

                  <div ref={mapContainerRef} className="leaflet-map-canvas"></div>

                  <div className="map-legend-bar">
                    <span className="legend-label">Legend:</span>
                    <span className="legend-chip"><span className="legend-dot dot-verified"></span> Verified Deed</span>
                    <span className="legend-chip"><span className="legend-dot dot-guideline"></span> Guideline Value</span>
                    <span className="legend-chip"><span className="legend-dot dot-asking"></span> Asking Price</span>
                    <span className="legend-chip"><span className="legend-dot dot-surveyor"></span> Field Surveyor</span>
                  </div>
                </div>

                {/* Right Column: Redesigned Valuation Panel */}
                <div className="valuation-side-panel">
                  {loadingEstimate ? (
                    <div className="valuation-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                      <h4 style={{ color: '#0f172a', marginBottom: '0.35rem', fontSize: '0.95rem', fontWeight: 700 }}>
                        Calculating Valuation...
                      </h4>
                      <p style={{ color: '#64748b', fontSize: '0.8125rem', margin: 0 }}>
                        Analyzing comparable transactions within 1,000m radius.
                      </p>
                    </div>
                  ) : errorEstimate ? (
                    <div className="flash-banner flash-error">
                      <span>{errorEstimate}</span>
                      <button className="btn btn-sm btn-secondary" onClick={() => fetchEstimate(targetLat, targetLng, selectedUsage)}>
                        Retry
                      </button>
                    </div>
                  ) : estimate?.status === 'Success' ? (
                    <>
                      {/* Primary Market Valuation Card */}
                      <div className="valuation-card">
                        <div className="val-header">
                          <div className="val-title-group">
                            <span className="val-section-title">Estimated Market Value</span>
                            <span className="val-evidence-count">
                              {estimate.comparableRecordCount} {estimate.comparableRecordCount === 1 ? 'record' : 'records'} within 1 km
                            </span>
                          </div>
                          <span className={`confidence-badge confidence-${estimate.confidence.toLowerCase()}`}>
                            <span className="confidence-dot"></span>
                            {estimate.confidence} Confidence
                          </span>
                        </div>

                        <div className="val-price-hero">
                          <span className="val-currency">₹</span>
                          <span className="val-amount">{(estimate.priceRangePerCent.medianRate / 100000).toFixed(2)}</span>
                          <span className="val-multiplier">Lakhs</span>
                          <span className="val-unit">/ Cent</span>
                        </div>

                        <div className="val-converted-rate">
                          ₹{estimate.priceRangePerSqFt.medianRate.toLocaleString('en-IN')} / Sq.Ft
                        </div>

                        {/* Structured Statistical Range Grid */}
                        <div className="val-metrics-grid">
                          <div className="val-metric-box">
                            <div className="val-metric-label">Typical Range (25th–75th)</div>
                            <div className="val-metric-value">
                              ₹{(estimate.priceRangePerCent.percentile25 / 100000).toFixed(2)}L – ₹{(estimate.priceRangePerCent.percentile75 / 100000).toFixed(2)}L
                            </div>
                            <div className="val-metric-sub">
                              ₹{estimate.priceRangePerSqFt.percentile25.toLocaleString('en-IN')} – ₹{estimate.priceRangePerSqFt.percentile75.toLocaleString('en-IN')} / sq.ft
                            </div>
                          </div>

                          <div className="val-metric-box">
                            <div className="val-metric-label">Observed Range (Min–Max)</div>
                            <div className="val-metric-value">
                              ₹{(estimate.priceRangePerCent.minRate / 100000).toFixed(2)}L – ₹{(estimate.priceRangePerCent.maxRate / 100000).toFixed(2)}L
                            </div>
                            <div className="val-metric-sub">
                              {estimate.comparableRecordCount} parcels in 1,000m radius
                            </div>
                          </div>
                        </div>

                        {/* Concise Legal & Statistical Disclaimer */}
                        <p className="val-disclaimer">
                          Indicative statistical estimate derived from recent 1,000m comparables; not an official legal appraisal or guaranteed sale price.
                        </p>
                      </div>

                      {/* Separate Restrained Benchmark Panel */}
                      {estimate.governmentGuidelineReference && (
                        <div className="benchmark-card">
                          <div className="benchmark-header">
                            <span className="benchmark-title">Government Guideline Benchmark</span>
                            <span className="benchmark-tag">Statutory</span>
                          </div>
                          <div className="benchmark-rate-row">
                            <div className="benchmark-rate-primary">
                              ₹{(estimate.governmentGuidelineReference.guidelineRatePerCent / 100000).toFixed(2)} Lakhs <span className="benchmark-rate-unit">/ Cent</span>
                            </div>
                            <div className="benchmark-rate-secondary">
                              ₹{estimate.governmentGuidelineReference.guidelineRatePerSqFt.toLocaleString('en-IN')} / Sq.Ft
                            </div>
                          </div>
                          <p className="benchmark-notice">
                            TNREGINET statutory minimum valuation benchmark for stamp duty registration; not an open-market transaction value.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Insufficient Data State */
                    <div className="insufficient-data-card">
                      <div className="insufficient-header">
                        <span className="insufficient-badge">Insufficient Data</span>
                      </div>
                      <h4 className="insufficient-heading">
                        Insufficient Records within 1,000m
                      </h4>
                      <p className="insufficient-body">
                        {estimate?.message ||
                          `Only ${estimate?.comparableRecordsFound || 0} comparable record(s) found within 1,000 metres for ${selectedUsage} land. A minimum of 3 records is required to calculate an evidence-based valuation.`}
                      </p>

                      {/* If reference guideline value exists for the selected locality, show as benchmark fallback */}
                      {(() => {
                        const matchingLoc = localities.find(l => l.name.toLowerCase() === selectedLocality.toLowerCase());
                        if (matchingLoc && matchingLoc.guidelineRatePerCent > 0) {
                          return (
                            <div className="benchmark-card" style={{ marginTop: '0.85rem' }}>
                              <div className="benchmark-header">
                                <span className="benchmark-title">Statutory Guideline Benchmark</span>
                                <span className="benchmark-tag">Statutory</span>
                              </div>
                              <div className="benchmark-rate-row">
                                <div className="benchmark-rate-primary">
                                  ₹{(matchingLoc.guidelineRatePerCent / 100000).toFixed(2)} Lakhs <span className="benchmark-rate-unit">/ Cent</span>
                                </div>
                              </div>
                              <p className="benchmark-notice">
                                Statutory benchmark rate for {matchingLoc.name}. Market comparable volume currently below estimation threshold.
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {estimate?.recommendations && estimate.recommendations.length > 0 && (
                        <div className="insufficient-recommendations">
                          <strong>Recommended:</strong>
                          <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0 }}>
                            {estimate.recommendations.map((rec, i) => (
                              <li key={i}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              VIEW 3: LAND RECORDS REGISTRY
              ===================================================================== */}
          {activeTab === 'records' && (
            <div>
              {errorRecords && (
                <div className="flash-banner flash-error" style={{ marginBottom: '1rem' }}>
                  <span>{errorRecords}</span>
                </div>
              )}

              {/* Registry Toolbar */}
              <div className="panel-card" style={{ marginBottom: '1rem' }}>
                <div className="panel-card-body" style={{ padding: '0.85rem 1rem' }}>
                  <div className="filter-toolbar">
                    <input
                      type="text"
                      className="text-input"
                      placeholder="Search locality, survey #, or street..."
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      style={{ flex: 1, minWidth: '200px' }}
                    />

                    <select
                      className="select-input"
                      value={filterLocality}
                      onChange={(e) => setFilterLocality(e.target.value)}
                    >
                      <option value="All">All Localities</option>
                      {localities.map((loc) => (
                        <option key={`${loc.name}-${loc.district}`} value={loc.name}>
                          {loc.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className="select-input"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="All">All Statuses</option>
                      <option value="Verified">Verified</option>
                      <option value="PendingReview">Pending Review</option>
                      <option value="Unverified">Unverified</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Archived">Archived</option>
                    </select>

                    <select
                      className="select-input"
                      value={filterSource}
                      onChange={(e) => setFilterSource(e.target.value)}
                    >
                      <option value="All">All Sources</option>
                      <option value="VerifiedTransaction">Verified Transaction</option>
                      <option value="GovernmentGuideline">Government Guideline</option>
                      <option value="AdvertisedAskingPrice">Advertised Asking</option>
                      <option value="ClientResearch">Client Research</option>
                    </select>

                    <select
                      className="select-input"
                      value={filterUsage}
                      onChange={(e) => setFilterUsage(e.target.value)}
                    >
                      <option value="All">All Usages</option>
                      <option value="Residential">Residential</option>
                      <option value="Commercial">Commercial</option>
                      <option value="Agricultural">Agricultural</option>
                      <option value="Industrial">Industrial</option>
                      <option value="MixedUse">MixedUse</option>
                    </select>

                    <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
                      <Icons.Plus />
                      <span>Add Record</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="panel-card">
                <div className="panel-card-header">
                  <div>
                    <h3>Land Records ({filteredRecords.length})</h3>
                    <div className="panel-card-subtitle">
                      Database records with geographic coordinates
                    </div>
                  </div>
                  <button className="btn btn-sm btn-secondary" onClick={fetchRecords} disabled={loadingRecords}>
                    <Icons.Refresh />
                    <span>{loadingRecords ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Locality</th>
                        <th>Survey #</th>
                        <th>Coordinates</th>
                        <th>Usage</th>
                        <th>Area</th>
                        <th>Price</th>
                        <th>Rate / Cent</th>
                        <th>Rate / Sq.Ft</th>
                        <th>Source</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                            No land records match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((r: ApiLandRecord) => (
                          <tr key={r.id}>
                            <td>
                              <strong>{r.locality}</strong>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{r.district}</div>
                            </td>
                            <td><code>{r.surveyNumber || '—'}</code></td>
                            <td>
                              <small>{r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}</small>
                            </td>
                            <td>{r.landUsage}</td>
                            <td>{r.originalArea} {r.originalUnit}</td>
                            <td>₹{r.originalPrice.toLocaleString('en-IN')}</td>
                            <td>
                              <strong>
                                ₹{(r.normalizedRatePerCent / 100000).toFixed(2)}L
                              </strong>
                            </td>
                            <td>₹{r.normalizedRatePerSqFt.toLocaleString('en-IN')}</td>
                            <td>
                              <span className={
                                r.sourceCategory === 'VerifiedTransaction' ? 'badge badge-green' :
                                  r.sourceCategory === 'GovernmentGuideline' ? 'badge badge-blue' :
                                    r.sourceCategory === 'AdvertisedAskingPrice' ? 'badge badge-orange' : 'badge badge-purple'
                              }>
                                {r.sourceCategory}
                              </span>
                            </td>
                            <td>
                              <span className={
                                r.verificationStatus === 'Verified' ? 'badge badge-green' :
                                  r.verificationStatus === 'PendingReview' ? 'badge badge-orange' :
                                    r.verificationStatus === 'Unverified' ? 'badge badge-gold' :
                                      r.verificationStatus === 'Rejected' ? 'badge badge-danger' : 'badge badge-gray'
                              }>
                                {r.verificationStatus === 'PendingReview' ? 'Pending Review' : r.verificationStatus}
                              </span>
                              {r.notes && (
                                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '3px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.notes}>
                                  {r.notes}
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                {r.verificationStatus !== 'Verified' && (
                                  <button
                                    className="btn btn-sm"
                                    style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 5px', fontSize: '0.72rem' }}
                                    onClick={() => handleOpenModerationModal(r, 2)}
                                    title="Verify Record (Eligible for Valuations)"
                                  >
                                    Verify
                                  </button>
                                )}
                                {r.verificationStatus !== 'PendingReview' && (
                                  <button
                                    className="btn btn-sm"
                                    style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', padding: '2px 5px', fontSize: '0.72rem' }}
                                    onClick={() => handleOpenModerationModal(r, 1)}
                                    title="Mark Pending Review"
                                  >
                                    Review
                                  </button>
                                )}
                                {r.verificationStatus !== 'Rejected' && (
                                  <button
                                    className="btn btn-sm btn-danger"
                                    style={{ padding: '2px 5px', fontSize: '0.72rem' }}
                                    onClick={() => handleOpenModerationModal(r, 3)}
                                    title="Reject Record (Excluded from Valuations)"
                                  >
                                    Reject
                                  </button>
                                )}
                                {r.verificationStatus !== 'Archived' && (
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    style={{ padding: '2px 5px', fontSize: '0.72rem' }}
                                    onClick={() => handleOpenModerationModal(r, 4)}
                                    title="Archive Historical Deed"
                                  >
                                    Archive
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              VIEW 4: BATCH CSV INGESTION
              ===================================================================== */}
          {activeTab === 'import' && (
            <div>
              {importSuccessMessage && (
                <div className="flash-banner flash-success">
                  <span>{importSuccessMessage}</span>
                  <button onClick={() => setImportSuccessMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                </div>
              )}

              {/* Final Import Summary Card */}
              {csvSummary && !csvSummary.dryRun && csvSummary.importedRows !== undefined && (
                <div className="panel-card" style={{ borderLeft: '4px solid #16a34a', marginBottom: '1.25rem' }}>
                  <div className="panel-card-body" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ color: '#16a34a' }}><Icons.Check /></span>
                          <h4 style={{ color: '#166534', margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                            Batch Dataset Ingested Successfully
                          </h4>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                          Persisted <strong>{csvSummary.importedRows}</strong> land price records into the database with default <code>Unverified</code> status.
                          {csvSummary.skippedRows > 0 && ` Skipped ${csvSummary.skippedRows} duplicates.`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={handleResetCsv}
                        >
                          Import Another File
                        </button>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => setActiveTab('records')}
                        >
                          View in Records Registry →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {csvError && (
                <div className="flash-banner flash-error">
                  <span>{csvError}</span>
                  <button onClick={() => setCsvError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                </div>
              )}

              {/* Upload Card */}
              <div className="panel-card">
                <div className="panel-card-header">
                  <div>
                    <h3>Batch CSV Ingestion</h3>
                    <div className="panel-card-subtitle">Upload CSV files to ingest, validate, and audit land records</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setShowSchemaGuide(!showSchemaGuide)}
                    >
                      <span>{showSchemaGuide ? 'Hide Schema Guide' : 'Column Mapping Guide'}</span>
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => api.downloadCsvTemplate()}>
                      <Icons.Download />
                      <span>Download Template</span>
                    </button>
                  </div>
                </div>

                <div className="panel-card-body">
                  {/* Schema Guide Drawer */}
                  {showSchemaGuide && (
                    <div style={{
                      background: '#f8fafc',
                      padding: '1rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      marginBottom: '1.25rem',
                      fontSize: '0.8125rem'
                    }}>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>
                        Canonical CSV Header Requirements & Formatting:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                        <div>
                          <div style={{ color: '#166534', fontWeight: 600, marginBottom: '0.25rem' }}>
                            ✓ Required Columns (9):
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#334155', lineHeight: 1.6 }}>
                            <li><code>locality</code> (e.g., Kannampalayam, Sulur)</li>
                            <li><code>latitude</code> (8.0 to 14.0 inside Tamil Nadu)</li>
                            <li><code>longitude</code> (76.0 to 81.0 inside Tamil Nadu)</li>
                            <li><code>landUsage</code> (Residential, Commercial, Industrial, AgriculturalWet, AgriculturalDry, MixedUse)</li>
                            <li><code>area</code> (Numeric, e.g., 3.5, 2400)</li>
                            <li><code>unit</code> (Cent, SqFt, Acre, Ground, Kuzhi, SqMeter)</li>
                            <li><code>price</code> (Total price in INR, e.g., 3675000)</li>
                            <li><code>sourceCategory</code> (VerifiedTransaction, GovernmentGuideline, AdvertisedAskingPrice, ClientResearch)</li>
                            <li><code>observationDate</code> (YYYY-MM-DD)</li>
                          </ul>
                        </div>
                        <div>
                          <div style={{ color: '#475569', fontWeight: 600, marginBottom: '0.25rem' }}>
                            ○ Optional Columns (8):
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#64748b', lineHeight: 1.6 }}>
                            <li><code>surveyNumber</code> (e.g., SF 142/2A)</li>
                            <li><code>taluk</code> (e.g., Sulur, Coimbatore South)</li>
                            <li><code>streetOrLandmark</code> (e.g., Trichy Road Branch)</li>
                            <li><code>district</code> (Default: Coimbatore)</li>
                            <li><code>state</code> (Default: Tamil Nadu)</li>
                            <li><code>country</code> (Default: India)</li>
                            <li><code>sourceReference</code> (e.g., SRO Sulur Doc 3412/2023)</li>
                            <li><code>notes</code> (Surveyor observations)</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Upload Dropzone */}
                  <div style={{
                    border: '1.5px dashed #cbd5e1',
                    borderRadius: '6px',
                    padding: '2rem 1.5rem',
                    textAlign: 'center',
                    background: '#f8fafc',
                    cursor: 'pointer',
                  }} onClick={() => fileInputRef.current?.click()}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      style={{ display: 'none' }}
                      onChange={handleFileSelected}
                    />
                    <div style={{ marginBottom: '0.5rem', color: '#64748b' }}>
                      <Icons.Upload />
                    </div>
                    <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>
                      {selectedCsvFile ? selectedCsvFile.name : 'Select or drop a CSV file to validate'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      RFC 4180 CSV format • Maximum 5 MB • Maximum 1,000 rows per batch
                    </div>
                  </div>

                  {isAnalyzingCsv && (
                    <div style={{ textAlign: 'center', padding: '1.25rem', color: '#64748b', fontSize: '0.85rem' }}>
                      Validating file headers, normalizing units, and checking spatial duplicate records...
                    </div>
                  )}

                  {/* Dry Run Preview Summary */}
                  {csvSummary && (
                    <div style={{ marginTop: '1.25rem' }}>
                      <div className="kpi-grid">
                        <div className="kpi-card">
                          <span className="kpi-title">Total Rows</span>
                          <div className="kpi-value">{csvSummary.totalRows}</div>
                        </div>

                        <div className="kpi-card">
                          <span className="kpi-title">Valid Records</span>
                          <div className="kpi-value" style={{ color: '#166534' }}>{csvSummary.validRows}</div>
                        </div>

                        <div className="kpi-card">
                          <span className="kpi-title">Duplicates Detected</span>
                          <div className="kpi-value" style={{ color: '#92400e' }}>{csvSummary.duplicateRows}</div>
                        </div>

                        <div className="kpi-card">
                          <span className="kpi-title">Invalid / Errors</span>
                          <div className="kpi-value" style={{ color: '#991b1b' }}>{csvSummary.invalidRows}</div>
                        </div>

                        <div className="kpi-card">
                          <span className="kpi-title">Ready to Ingest</span>
                          <div className="kpi-value" style={{ color: '#581c87' }}>
                            {skipDuplicates
                              ? Math.max(0, csvSummary.validRows - csvSummary.duplicateRows)
                              : csvSummary.validRows}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem', padding: '0.85rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={skipDuplicates}
                            onChange={(e) => handleToggleSkipDuplicates(e.target.checked)}
                          />
                          <span>Skip duplicate records (spatial proximity &amp; survey number match)</span>
                        </label>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-secondary btn-sm" onClick={handleResetCsv}>
                            Reset
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={csvSummary.validRows === 0 || isExecutingImport}
                            onClick={() => {
                              setImportConfirmAcknowledged(false);
                              setIsImportConfirmOpen(true);
                            }}
                          >
                            {isExecutingImport ? 'Importing...' : `Execute Import (${skipDuplicates ? Math.max(0, csvSummary.validRows - csvSummary.duplicateRows) : csvSummary.validRows} Records)`}
                          </button>
                        </div>
                      </div>

                      {/* Row Diagnostics / Validation Errors */}
                      {csvSummary.diagnostics && csvSummary.diagnostics.length > 0 && (
                        <div style={{ marginTop: '1.25rem' }}>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#991b1b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Icons.Alert /> Validation Issues ({csvSummary.diagnostics.length})
                          </h4>
                          <div className="table-wrapper">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Row</th>
                                  <th>Field</th>
                                  <th>Severity</th>
                                  <th>Message</th>
                                </tr>
                              </thead>
                              <tbody>
                                {csvSummary.diagnostics.map((d, i) => (
                                  <tr key={i}>
                                    <td><code>Row {d.rowNumber}</code></td>
                                    <td>{d.field}</td>
                                    <td>
                                      <span className={d.severity === 'Error' ? 'badge badge-danger' : 'badge badge-gold'}>
                                        {d.severity}
                                      </span>
                                    </td>
                                    <td>{d.message}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Record Previews Table */}
                      {csvSummary.previews && csvSummary.previews.length > 0 && (
                        <div style={{ marginTop: '1.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div>
                              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', margin: '0 0 0.15rem 0' }}>
                                Parsed Records Preview ({filteredPreviews.length} of {csvSummary.previews.length} rows)
                              </h4>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                Inspect normalized rates and duplicate status before committing to database
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                              <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{
                                    borderRadius: 0,
                                    border: 'none',
                                    background: previewFilter === 'all' ? '#240046' : '#ffffff',
                                    color: previewFilter === 'all' ? '#ffffff' : '#475569',
                                    padding: '4px 8px',
                                    fontSize: '0.75rem',
                                  }}
                                  onClick={() => { setPreviewFilter('all'); setPreviewPage(1); }}
                                >
                                  All ({csvSummary.previews.length})
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{
                                    borderRadius: 0,
                                    border: 'none',
                                    borderLeft: '1px solid #cbd5e1',
                                    background: previewFilter === 'valid' ? '#166534' : '#ffffff',
                                    color: previewFilter === 'valid' ? '#ffffff' : '#475569',
                                    padding: '4px 8px',
                                    fontSize: '0.75rem',
                                  }}
                                  onClick={() => { setPreviewFilter('valid'); setPreviewPage(1); }}
                                >
                                  Valid ({csvSummary.validRows - csvSummary.duplicateRows})
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{
                                    borderRadius: 0,
                                    border: 'none',
                                    borderLeft: '1px solid #cbd5e1',
                                    background: previewFilter === 'duplicate' ? '#92400e' : '#ffffff',
                                    color: previewFilter === 'duplicate' ? '#ffffff' : '#475569',
                                    padding: '4px 8px',
                                    fontSize: '0.75rem',
                                  }}
                                  onClick={() => { setPreviewFilter('duplicate'); setPreviewPage(1); }}
                                >
                                  Duplicates ({csvSummary.duplicateRows})
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{
                                    borderRadius: 0,
                                    border: 'none',
                                    borderLeft: '1px solid #cbd5e1',
                                    background: previewFilter === 'invalid' ? '#991b1b' : '#ffffff',
                                    color: previewFilter === 'invalid' ? '#ffffff' : '#475569',
                                    padding: '4px 8px',
                                    fontSize: '0.75rem',
                                  }}
                                  onClick={() => { setPreviewFilter('invalid'); setPreviewPage(1); }}
                                >
                                  Errors ({csvSummary.invalidRows})
                                </button>
                              </div>

                              <input
                                type="text"
                                className="text-input"
                                placeholder="Search locality or survey..."
                                value={previewSearch}
                                onChange={(e) => { setPreviewSearch(e.target.value); setPreviewPage(1); }}
                                style={{ padding: '4px 8px', fontSize: '0.75rem', width: '180px' }}
                              />
                            </div>
                          </div>

                          <div className="table-wrapper">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Row</th>
                                  <th>Status</th>
                                  <th>Locality</th>
                                  <th>Survey #</th>
                                  <th>Coordinates</th>
                                  <th>Usage</th>
                                  <th>Area</th>
                                  <th>Price</th>
                                  <th>Normalized Rates</th>
                                  <th>Source</th>
                                  <th>Diagnostics / Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedPreviews.length === 0 ? (
                                  <tr>
                                    <td colSpan={11} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                                      No preview records match the selected filter.
                                    </td>
                                  </tr>
                                ) : (
                                  paginatedPreviews.map((p: ValidatedRecordPreview) => (
                                    <tr key={p.rowNumber}>
                                      <td><code>Row {p.rowNumber}</code></td>
                                      <td>
                                        {!p.isValid ? (
                                          <span className="badge badge-danger">Invalid</span>
                                        ) : p.isDuplicate ? (
                                          <span className="badge badge-orange">{skipDuplicates ? 'Duplicate (Skip)' : 'Duplicate'}</span>
                                        ) : (
                                          <span className="badge badge-green">Ready to Import</span>
                                        )}
                                      </td>
                                      <td>
                                        <strong>{p.locality}</strong>
                                        {p.taluk && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{p.taluk}</div>}
                                      </td>
                                      <td><code>{p.surveyNumber || '—'}</code></td>
                                      <td>
                                        <small>{p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}</small>
                                      </td>
                                      <td>{p.landUsage}</td>
                                      <td>{p.area} {p.unit}</td>
                                      <td>₹{p.price.toLocaleString('en-IN')}</td>
                                      <td>
                                        <strong>₹{(p.normalizedRatePerCent / 100000).toFixed(2)}L/c</strong>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>₹{p.normalizedRatePerSqFt.toLocaleString('en-IN')}/sq.ft</div>
                                      </td>
                                      <td>
                                        <span className={
                                          p.sourceCategory === 'VerifiedTransaction' ? 'badge badge-green' :
                                            p.sourceCategory === 'GovernmentGuideline' ? 'badge badge-blue' :
                                              p.sourceCategory === 'AdvertisedAskingPrice' ? 'badge badge-orange' : 'badge badge-purple'
                                        }>
                                          {p.sourceCategory}
                                        </span>
                                      </td>
                                      <td>
                                        {!p.isValid && p.errors.length > 0 && (
                                          <div style={{ color: '#991b1b', fontSize: '0.72rem' }}>
                                            {p.errors.join('; ')}
                                          </div>
                                        )}
                                        {p.isDuplicate && (
                                          <div style={{ color: '#92400e', fontSize: '0.72rem' }}>
                                            {p.duplicateReason || 'Duplicate spatial coordinates / survey number.'}
                                          </div>
                                        )}
                                        {p.isValid && !p.isDuplicate && (
                                          <div style={{ color: '#166534', fontSize: '0.72rem' }}>
                                            ✓ Coordinates valid within Tamil Nadu bounds
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Pagination Bar */}
                          {totalPreviewPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.8125rem', color: '#64748b' }}>
                              <span>
                                Showing page {previewPage} of {totalPreviewPages} ({filteredPreviews.length} total preview rows)
                              </span>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  disabled={previewPage <= 1}
                                  onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                                >
                                  Previous
                                </button>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  disabled={previewPage >= totalPreviewPages}
                                  onClick={() => setPreviewPage(p => Math.min(totalPreviewPages, p + 1))}
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Historical Import Batches */}
              <div className="panel-card">
                <div className="panel-card-header">
                  <div>
                    <h3>Import History</h3>
                    <div className="panel-card-subtitle">Recent batch executions</div>
                  </div>
                  <button className="btn btn-sm btn-secondary" onClick={fetchImportHistory} disabled={loadingHistory}>
                    <Icons.Refresh />
                    <span>{loadingHistory ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Batch ID</th>
                        <th>File</th>
                        <th>Triggered By</th>
                        <th>Execution Mode</th>
                        <th>Total</th>
                        <th>Valid</th>
                        <th>Duplicates</th>
                        <th>Imported</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importHistory.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                            No import batches recorded yet.
                          </td>
                        </tr>
                      ) : (
                        importHistory.map((b) => (
                          <tr key={b.id}>
                            <td><code>{b.id.substring(0, 8)}</code></td>
                            <td>{b.fileName} <small style={{ color: '#64748b' }}>({(b.fileSizeBytes / 1024).toFixed(1)} KB)</small></td>
                            <td>{b.triggeredBy}</td>
                            <td>
                              <span className={b.dryRun ? 'badge badge-gold' : 'badge badge-green'}>
                                {b.dryRun ? 'Dry Run' : 'Persisted'}
                              </span>
                            </td>
                            <td>{b.totalRows}</td>
                            <td>{b.validRows}</td>
                            <td>{b.duplicateRows}</td>
                            <td><strong>{b.importedRows}</strong></td>
                            <td><small>{new Date(b.executedAtUtc).toLocaleString()}</small></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              VIEW 5: STATEWIDE COVERAGE
              ===================================================================== */}
          {activeTab === 'statewide' && (
            <div>
              <div className="kpi-grid">
                <div className="kpi-card">
                  <span className="kpi-title">Active Districts</span>
                  <div className="kpi-value">{coverageSummary ? `${coverageSummary.activeDistrictsCount} / 38` : '1 / 38'}</div>
                  <div className="kpi-footer">Tamil Nadu revenue districts</div>
                </div>

                <div className="kpi-card">
                  <span className="kpi-title">Verified Registered Deeds</span>
                  <div className="kpi-value" style={{ color: '#166534' }}>
                    {coverageSummary ? coverageSummary.totalVerified : analytics.verified}
                  </div>
                  <div className="kpi-footer">Audited transaction pool</div>
                </div>

                <div className="kpi-card">
                  <span className="kpi-title">Guideline Records</span>
                  <div className="kpi-value" style={{ color: '#1d4ed8' }}>
                    {coverageSummary ? coverageSummary.totalGuideline : analytics.bySource.GovernmentGuideline}
                  </div>
                  <div className="kpi-footer">Statutory benchmarks</div>
                </div>

                <div className="kpi-card">
                  <span className="kpi-title">ML Promotion Status</span>
                  <div className="kpi-value" style={{ color: '#92400e', fontSize: '1.25rem' }}>
                    {mlReport ? `${mlReport.totalStatewideVerifiedTransactions} / 500 Deeds` : 'Gated'}
                  </div>
                  <div className="kpi-footer">Minimum threshold gate</div>
                </div>
              </div>

              {/* ML Governance Policy Card */}
              <div className="panel-card" style={{ background: '#f8fafc', borderLeft: '3px solid #240046' }}>
                <div className="panel-card-body" style={{ padding: '1rem 1.25rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                    Machine Learning Governance Policy
                  </h4>
                  <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                    {mlReport?.productionReadinessVerdict ||
                      'Production ML models are gated until sufficient verified registered deed volume is ingested per target district. The statistical median estimation engine remains active for all customer valuations.'}
                  </p>
                </div>
              </div>

              {/* 38-District Matrix */}
              <div className="panel-card">
                <div className="panel-card-header">
                  <div>
                    <h3>Tamil Nadu District Matrix</h3>
                    <div className="panel-card-subtitle">Data availability across all 38 revenue districts</div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="Search district..."
                      value={statewideFilterDistrict}
                      onChange={(e) => setStatewideFilterDistrict(e.target.value)}
                      style={{ fontSize: '0.8125rem', padding: '0.35rem 0.65rem' }}
                    />
                    <select
                      className="select-input"
                      value={statewideFilterStatus}
                      onChange={(e) => setStatewideFilterStatus(e.target.value)}
                      style={{ fontSize: '0.8125rem', padding: '0.35rem 0.65rem' }}
                    >
                      <option value="All">All Statuses</option>
                      <option value="PilotHub">Pilot Hub</option>
                      <option value="Moderate">Moderate (≥50)</option>
                      <option value="Sparse">Sparse (&lt;50)</option>
                      <option value="NoData">No Data (0)</option>
                    </select>

                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={fetchStatewideData}
                      disabled={loadingCoverage || loadingMlReport || loadingProviders}
                    >
                      <Icons.Refresh />
                      <span>{loadingCoverage || loadingMlReport || loadingProviders ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>District</th>
                        <th>Status</th>
                        <th>Total Records</th>
                        <th>Verified Deeds</th>
                        <th>Unverified</th>
                        <th>Guideline Records</th>
                        <th>Localities</th>
                        <th>Latest Record</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coverageSummary?.districtBreakdown
                        .filter((d) => {
                          const matchName = !statewideFilterDistrict || d.district.toLowerCase().includes(statewideFilterDistrict.toLowerCase());
                          const matchStat = statewideFilterStatus === 'All' || d.status === statewideFilterStatus;
                          return matchName && matchStat;
                        })
                        .map((d) => (
                          <tr key={d.district} style={{ opacity: d.recordCount > 0 ? 1 : 0.65 }}>
                            <td><strong>{d.district}</strong></td>
                            <td>
                              <span className={
                                d.status === 'PilotHub' ? 'badge badge-purple' :
                                  d.status === 'Moderate' ? 'badge badge-green' :
                                    d.status === 'Sparse' ? 'badge badge-orange' : 'badge badge-gray'
                              }>
                                {d.status === 'PilotHub' ? 'Pilot Hub' : d.status}
                              </span>
                            </td>
                            <td>{d.recordCount}</td>
                            <td>{d.verifiedCount}</td>
                            <td>{d.unverifiedCount}</td>
                            <td>{d.guidelineCount}</td>
                            <td>{d.activeLocalities.length > 0 ? d.activeLocalities.join(', ') : '—'}</td>
                            <td><small>{d.latestObservationDate ? new Date(d.latestObservationDate).toLocaleDateString() : '—'}</small></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Data Providers */}
              <div className="panel-card">
                <div className="panel-card-header">
                  <div>
                    <h3>Registered Data Providers</h3>
                    <div className="panel-card-subtitle">Data provider integrations and coverage terms</div>
                  </div>
                </div>
                <div className="panel-card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                    {providers.map((p) => (
                      <div
                        key={p.providerId}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                            <span className={p.isLiveFeedAvailable ? 'badge badge-green' : 'badge badge-gray'}>
                              {p.isLiveFeedAvailable ? 'Connected' : 'Manual Ingestion'}
                            </span>
                            <span className="badge badge-purple">{p.sourceCategory}</span>
                          </div>
                          <h4 style={{ color: '#0f172a', marginBottom: '0.35rem', fontSize: '0.95rem' }}>{p.providerName}</h4>
                          <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.45, marginBottom: '0.65rem' }}>
                            {p.dataIntegrityNote}
                          </p>
                        </div>
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                          <div><strong>Coverage:</strong> {p.coverage.regionName}</div>
                          <div><strong>Terms:</strong> {p.licenseTerms}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              VIEW 6: METHODOLOGY
              ===================================================================== */}
          {activeTab === 'methodology' && (
            <div className="panel-card">
              <div className="panel-card-header">
                <div>
                  <h3>Valuation Methodology</h3>
                  <div className="panel-card-subtitle">
                    Core principles governing land market rate estimation
                  </div>
                </div>
              </div>
              <div className="panel-card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ color: '#0f172a', marginBottom: '0.35rem', fontSize: '0.9rem' }}>1. Target Location Independence</h4>
                    <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
                      Valuation searches are performed for explicitly selected property coordinates and do not depend on the device's physical GPS location.
                    </p>
                  </div>

                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ color: '#0f172a', marginBottom: '0.35rem', fontSize: '0.9rem' }}>2. Guideline Value Separation</h4>
                    <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
                      Statutory Government Guideline Values and open-market transactions are maintained separately and never averaged together.
                    </p>
                  </div>

                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ color: '#0f172a', marginBottom: '0.35rem', fontSize: '0.9rem' }}>3. Statistical Median & Range</h4>
                    <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
                      Estimates use non-parametric median and interquartile ranges, reducing distortion from extreme speculative asking prices.
                    </p>
                  </div>

                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ color: '#0f172a', marginBottom: '0.35rem', fontSize: '0.9rem' }}>4. Insufficient Data Protocol</h4>
                    <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
                      When fewer than 3 comparable records exist within 1,000 metres, the system returns an honest Insufficient Data notice without fabricating estimates.
                    </p>
                  </div>

                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ color: '#0f172a', marginBottom: '0.35rem', fontSize: '0.9rem' }}>5. Unverified Ingestion Default</h4>
                    <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
                      All newly imported records default to Unverified status until audited and confirmed by an administrator.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =========================================================================
          MODAL: ADD LAND RECORD
          ========================================================================= */}
      {isAddModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Add Land Record</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRecordSubmit}>
              <div className="modal-body">
                {submitError && (
                  <div className="flash-banner flash-error" style={{ marginBottom: '1rem' }}>
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Locality *</label>
                    <input
                      type="text"
                      className="text-input"
                      required
                      value={addFormData.locality}
                      onChange={(e) => setAddFormData({ ...addFormData, locality: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Taluk</label>
                    <input
                      type="text"
                      className="text-input"
                      value={addFormData.taluk || ''}
                      onChange={(e) => setAddFormData({ ...addFormData, taluk: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Survey Number</label>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="e.g. SF 142/2A"
                      value={addFormData.surveyNumber || ''}
                      onChange={(e) => setAddFormData({ ...addFormData, surveyNumber: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Classification</label>
                    <select
                      className="select-input"
                      value={addFormData.landUsage}
                      onChange={(e) => setAddFormData({ ...addFormData, landUsage: parseInt(e.target.value, 10) })}
                    >
                      <option value={1}>Residential</option>
                      <option value={2}>Commercial</option>
                      <option value={3}>Agricultural</option>
                      <option value={5}>Industrial</option>
                      <option value={6}>MixedUse</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Latitude *</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="text-input"
                      required
                      value={addFormData.latitude}
                      onChange={(e) => setAddFormData({ ...addFormData, latitude: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Longitude *</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="text-input"
                      required
                      value={addFormData.longitude}
                      onChange={(e) => setAddFormData({ ...addFormData, longitude: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Area *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="text-input"
                      required
                      value={addFormData.area}
                      onChange={(e) => setAddFormData({ ...addFormData, area: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Unit *</label>
                    <select
                      className="select-input"
                      value={addFormData.unit}
                      onChange={(e) => setAddFormData({ ...addFormData, unit: parseInt(e.target.value, 10) })}
                    >
                      <option value={2}>Cent</option>
                      <option value={1}>Sq.Ft</option>
                      <option value={3}>Acre</option>
                      <option value={4}>Ground</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Total Price (INR) *</label>
                    <input
                      type="number"
                      className="text-input"
                      required
                      value={addFormData.price}
                      onChange={(e) => setAddFormData({ ...addFormData, price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Source Category *</label>
                    <select
                      className="select-input"
                      value={addFormData.sourceCategory}
                      onChange={(e) => setAddFormData({ ...addFormData, sourceCategory: parseInt(e.target.value, 10) })}
                    >
                      <option value={2}>Verified Transaction (Sale Deed)</option>
                      <option value={1}>Government Guideline</option>
                      <option value={3}>Advertised Asking</option>
                      <option value={4}>Client Research</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: '0.85rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.8125rem' }}>
                  <span>Rate per Cent: <strong>₹{addFormData.area > 0 && addFormData.price > 0 ? Math.round(addFormData.price / addFormData.area).toLocaleString('en-IN') : '0'}</strong></span>
                  <span style={{ marginLeft: '1rem', color: '#64748b' }}>Default Status: <span className="badge badge-gold">Unverified</span></span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingRecord}>
                  {isSubmittingRecord ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: BATCH CSV INGESTION CONFIRMATION
          ========================================================================= */}
      {isImportConfirmOpen && csvSummary && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>Confirm Batch Dataset Ingestion</h3>
              <button
                onClick={() => setIsImportConfirmOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: '#0f172a', fontSize: '0.875rem', lineHeight: 1.5, marginBottom: '0.85rem' }}>
                You are about to execute database ingestion for file: <strong>{selectedCsvFile?.name}</strong>.
              </p>

              <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Records to Ingest:</span>
                    <strong style={{ color: '#166534', fontSize: '1.1rem' }}>
                      {skipDuplicates
                        ? Math.max(0, csvSummary.validRows - csvSummary.duplicateRows)
                        : csvSummary.validRows}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Duplicates to Skip:</span>
                    <strong style={{ color: '#92400e', fontSize: '1.1rem' }}>
                      {skipDuplicates ? csvSummary.duplicateRows : 0}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Invalid Excluded:</span>
                    <strong style={{ color: '#991b1b', fontSize: '1.1rem' }}>{csvSummary.invalidRows}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Default Status:</span>
                    <span className="badge badge-gold">Unverified</span>
                  </div>
                </div>
                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem', color: '#64748b', fontSize: '0.75rem' }}>
                  • Ingested records will be persisted to PostgreSQL and indexed spatially via PostGIS.
                  <br />• All imported records require administrative audit before becoming eligible as verified market evidence.
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer', padding: '0.5rem', background: '#f1f5f9', borderRadius: '4px' }}>
                <input
                  type="checkbox"
                  style={{ marginTop: '2px' }}
                  checked={importConfirmAcknowledged}
                  onChange={(e) => setImportConfirmAcknowledged(e.target.checked)}
                />
                <span>
                  I have inspected the previewed records and confirm committing these records to the Greenart production database.
                </span>
              </label>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsImportConfirmOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleExecuteImport}
                disabled={isExecutingImport || !importConfirmAcknowledged}
              >
                {isExecutingImport ? 'Ingesting Dataset...' : 'Confirm & Ingest Records'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: LAND RECORD VERIFICATION & MODERATION
          ========================================================================= */}
      {moderationRecord && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Review Land Record</h3>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  ID: <code>{moderationRecord.id.substring(0, 8)}</code> • {moderationRecord.locality} ({moderationRecord.district})
                </div>
              </div>
              <button
                onClick={() => setModerationRecord(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Record Summary Box */}
              <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Survey Number</span>
                    <strong>{moderationRecord.surveyNumber || 'None / Unspecified'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Coordinates</span>
                    <code>{moderationRecord.latitude.toFixed(4)}, {moderationRecord.longitude.toFixed(4)}</code>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Area & Usage</span>
                    <span>{moderationRecord.originalArea} {moderationRecord.originalUnit} • {moderationRecord.landUsage}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Price & Rates</span>
                    <strong>₹{(moderationRecord.normalizedRatePerCent / 100000).toFixed(2)}L/cent</strong>
                    <span style={{ color: '#64748b', marginLeft: '4px' }}>(₹{moderationRecord.normalizedRatePerSqFt}/sq.ft)</span>
                  </div>
                </div>
                <div style={{ marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#64748b' }}>Current Status:</span>
                  <span className={
                    moderationRecord.verificationStatus === 'Verified' ? 'badge badge-green' :
                      moderationRecord.verificationStatus === 'PendingReview' ? 'badge badge-orange' :
                        moderationRecord.verificationStatus === 'Unverified' ? 'badge badge-gold' :
                          moderationRecord.verificationStatus === 'Rejected' ? 'badge badge-danger' : 'badge badge-gray'
                  }>
                    {moderationRecord.verificationStatus === 'PendingReview' ? 'Pending Review' : moderationRecord.verificationStatus}
                  </span>
                  <span style={{ color: '#64748b', marginLeft: 'auto' }}>Source: <strong>{moderationRecord.sourceCategory}</strong></span>
                </div>
              </div>

              {/* Status Selector */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Target Verification Status *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setModerationTargetStatus(2);
                      setModerationAuditNote('Verified against official land deed and survey records.');
                    }}
                    style={{
                      padding: '0.65rem',
                      borderRadius: '6px',
                      border: moderationTargetStatus === 2 ? '2px solid #16a34a' : '1px solid #cbd5e1',
                      background: moderationTargetStatus === 2 ? '#f0fdf4' : '#ffffff',
                      color: moderationTargetStatus === 2 ? '#166534' : '#334155',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.82rem'
                    }}
                  >
                    <div>✓ Verified</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 400, color: '#64748b', marginTop: '2px' }}>
                      Eligible for valuation
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModerationTargetStatus(1);
                      setModerationAuditNote('Pending physical survey and secondary title verification.');
                    }}
                    style={{
                      padding: '0.65rem',
                      borderRadius: '6px',
                      border: moderationTargetStatus === 1 ? '2px solid #f97316' : '1px solid #cbd5e1',
                      background: moderationTargetStatus === 1 ? '#fff7ed' : '#ffffff',
                      color: moderationTargetStatus === 1 ? '#c2410c' : '#334155',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.82rem'
                    }}
                  >
                    <div>⏱ Pending Review</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 400, color: '#64748b', marginTop: '2px' }}>
                      Held for audit
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModerationTargetStatus(3);
                      setModerationAuditNote('Rejected by administrative audit (disputed boundary / outlier pricing).');
                    }}
                    style={{
                      padding: '0.65rem',
                      borderRadius: '6px',
                      border: moderationTargetStatus === 3 ? '2px solid #dc2626' : '1px solid #cbd5e1',
                      background: moderationTargetStatus === 3 ? '#fef2f2' : '#ffffff',
                      color: moderationTargetStatus === 3 ? '#991b1b' : '#334155',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.82rem'
                    }}
                  >
                    <div>✕ Rejected</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 400, color: '#64748b', marginTop: '2px' }}>
                      Excluded from valuation
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModerationTargetStatus(4);
                      setModerationAuditNote('Archived historical land record.');
                    }}
                    style={{
                      padding: '0.65rem',
                      borderRadius: '6px',
                      border: moderationTargetStatus === 4 ? '2px solid #64748b' : '1px solid #cbd5e1',
                      background: moderationTargetStatus === 4 ? '#f1f5f9' : '#ffffff',
                      color: moderationTargetStatus === 4 ? '#334155' : '#334155',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.82rem'
                    }}
                  >
                    <div>📦 Archived</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 400, color: '#64748b', marginTop: '2px' }}>
                      Historical deed
                    </div>
                  </button>
                </div>
              </div>

              {/* Audit Reason / Note */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Audit Note & Reason *</label>
                <textarea
                  className="text-input"
                  rows={3}
                  value={moderationAuditNote}
                  onChange={(e) => setModerationAuditNote(e.target.value)}
                  placeholder="Enter administrative audit reason or deed verification reference..."
                  style={{ width: '100%', resize: 'vertical' }}
                  required
                />
              </div>

              {/* Domain Rule Explanation Alert */}
              <div style={{
                padding: '0.75rem',
                borderRadius: '4px',
                fontSize: '0.78rem',
                lineHeight: 1.4,
                background: moderationTargetStatus === 2 ? '#f0fdf4' : moderationTargetStatus === 3 || moderationTargetStatus === 4 ? '#fef2f2' : '#fffbeb',
                color: moderationTargetStatus === 2 ? '#166534' : moderationTargetStatus === 3 || moderationTargetStatus === 4 ? '#991b1b' : '#92400e',
                border: moderationTargetStatus === 2 ? '1px solid #bbf7d0' : moderationTargetStatus === 3 || moderationTargetStatus === 4 ? '1px solid #fecaca' : '1px solid #fde68a',
              }}>
                {moderationTargetStatus === 2 && (
                  <div><strong>Valuation Impact:</strong> This record will be actively included in the 1,000m radius median estimation and IQR calculation as verified evidence.</div>
                )}
                {moderationTargetStatus === 1 && (
                  <div><strong>Valuation Impact:</strong> This record is flagged for physical surveyor inspection. It will remain in review until an administrator verifies or rejects it.</div>
                )}
                {moderationTargetStatus === 3 && (
                  <div><strong>Valuation Impact:</strong> Rejected records are strictly quarantined and permanently excluded from land valuation calculations.</div>
                )}
                {moderationTargetStatus === 4 && (
                  <div><strong>Valuation Impact:</strong> Archived records are preserved for audit logging but excluded from current market rate estimations.</div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModerationRecord(null)}
                disabled={isSubmittingModeration}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmModeration}
                disabled={isSubmittingModeration || !moderationAuditNote.trim()}
              >
                {isSubmittingModeration ? 'Updating...' : 'Confirm Status Transition'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADMIN API KEY CONFIGURATION
          ========================================================================= */}
      {isAdminKeyModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>Admin API Key Configuration</h3>
              <button
                onClick={() => setIsAdminKeyModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: '#475569', fontSize: '0.8125rem', lineHeight: 1.5, marginBottom: '1rem' }}>
                Protected operations (Batch CSV ingestion and record moderation) require administrative authentication via the <code>X-Admin-Key</code> header.
              </p>

              <div className="form-group">
                <label className="form-label">Administrative API Key</label>
                <input
                  type="password"
                  className="text-input"
                  style={{ width: '100%' }}
                  placeholder="Enter administrative API key..."
                  value={adminKeyInput}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b' }}>
                Key is securely stored in your browser's session storage and cleared when you close the tab.
              </div>
            </div>

            <div className="modal-footer">
              {adminKey && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  style={{ marginRight: 'auto' }}
                  onClick={() => {
                    api.setAdminKey('');
                    setAdminKey('');
                    setAdminKeyInput('');
                    setIsAdminKeyModalOpen(false);
                    setNotification('Admin API Key cleared from session.');
                    setTimeout(() => setNotification(null), 3000);
                  }}
                >
                  Clear Key
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsAdminKeyModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  api.setAdminKey(adminKeyInput);
                  setAdminKey(adminKeyInput.trim());
                  setIsAdminKeyModalOpen(false);
                  setNotification('Admin API Key saved successfully in session.');
                  setTimeout(() => setNotification(null), 3000);
                }}
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
