import React, { useState, useEffect, useRef } from 'react';
import {
  api,
  ApiLandRecord,
  LocalityReference,
  HealthCheckResponse,
  EstimateApiResponse,
  CreateLandRecordPayload,
} from './services/api';

export const App = () => {
  const [activeTab, setActiveTab] = useState<'map' | 'records' | 'import' | 'guide'>('map');

  // Health and connectivity
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [isApiConnected, setIsApiConnected] = useState<boolean>(false);

  // Map & Estimation Target
  const [targetLat, setTargetLat] = useState<number>(11.0012);
  const [targetLng, setTargetLng] = useState<number>(77.0874);
  const [selectedLocality, setSelectedLocality] = useState<string>('Kannampalayam');
  const [selectedUsage, setSelectedUsage] = useState<string>('Residential');
  const [radiusMeters] = useState<number>(1000);

  // Data from backend
  const [localities, setLocalities] = useState<LocalityReference[]>([]);
  const [records, setRecords] = useState<ApiLandRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);
  const [errorRecords, setErrorRecords] = useState<string | null>(null);

  const [estimate, setEstimate] = useState<EstimateApiResponse | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState<boolean>(false);
  const [errorEstimate, setErrorEstimate] = useState<string | null>(null);

  // Filters for Registry Tab
  const [filterLocality, setFilterLocality] = useState<string>('All');
  const [filterSource, setFilterSource] = useState<string>('All');

  // Add Record Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isSubmittingRecord, setIsSubmittingRecord] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [addFormData, setAddFormData] = useState<CreateLandRecordPayload>({
    locality: 'Kannampalayam',
    taluk: 'Sulur',
    streetOrLandmark: '',
    surveyNumber: '',
    latitude: 11.0015,
    longitude: 77.0878,
    landUsage: 1, // Residential
    area: 3.5,
    unit: 2, // Cent
    price: 3675000,
    sourceCategory: 2, // VerifiedTransaction
    sourceReference: '',
    notes: '',
  });

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);

  // 1. Initial Health Check & Data Loading
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
        undefined,
        filterSource !== 'All' ? getSourceCategoryInt(filterSource) : undefined
      );
      setRecords(data);
    } catch (err: any) {
      setErrorRecords(err.message || 'Failed to load land records from database.');
    } finally {
      setLoadingRecords(false);
    }
  }, [filterLocality, filterSource]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // 3. Fetch Live Spatial Estimate from PostGIS Backend
  const fetchEstimate = React.useCallback(async (lat: number, lng: number, usage: string) => {
    setLoadingEstimate(true);
    setErrorEstimate(null);
    try {
      const usageInt = getLandUsageInt(usage);
      const res = await api.calculateEstimate(lat, lng, usageInt, radiusMeters);
      setEstimate(res);
    } catch (err: any) {
      setErrorEstimate(err.message || 'Failed to calculate spatial estimate.');
      setEstimate(null);
    } finally {
      setLoadingEstimate(false);
    }
  }, [radiusMeters]);

  useEffect(() => {
    if (activeTab === 'map') {
      fetchEstimate(targetLat, targetLng, selectedUsage);
    }
  }, [activeTab, targetLat, targetLng, selectedUsage, fetchEstimate]);

  // Helper mappings
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

  // 4. Initialize & Update Leaflet Map with Real Database Records
  useEffect(() => {
    if (activeTab !== 'map') return;

    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current).setView([targetLat, targetLng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapInstanceRef.current);

      // Interactive Map Click: allow clicking anywhere to update target coordinates
      mapInstanceRef.current.on('click', (e: any) => {
        const clickedLat = Math.round(e.latlng.lat * 10000) / 10000;
        const clickedLng = Math.round(e.latlng.lng * 10000) / 10000;
        setTargetLat(clickedLat);
        setTargetLng(clickedLng);
        setSelectedLocality('Custom Coordinate');
      });
    } else {
      mapInstanceRef.current.setView([targetLat, targetLng], 15);
      mapInstanceRef.current.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.Circle) {
          mapInstanceRef.current.removeLayer(layer);
        }
      });
    }

    const map = mapInstanceRef.current;

    // Target Marker
    const targetIcon = L.divIcon({
      className: 'target-pin-icon',
      html: `<div style="background:#1b5e20;color:#fff;border:2px solid #fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.3);">📍</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    L.marker([targetLat, targetLng], { icon: targetIcon })
      .addTo(map)
      .bindPopup(`<strong>Target Estimation Center</strong><br/>${selectedLocality}<br/>Lat: ${targetLat}, Lng: ${targetLng}`)
      .openPopup();

    // 1,000m Spatial Buffer Circle
    L.circle([targetLat, targetLng], {
      color: '#1b5e20',
      fillColor: '#4caf50',
      fillOpacity: 0.15,
      radius: radiusMeters,
      dashArray: '4, 6',
      weight: 2,
    }).addTo(map);

    // Plot real database records on the map
    records.forEach((r) => {
      const color =
        r.sourceCategory === 'VerifiedTransaction'
          ? '#2e7d32'
          : r.sourceCategory === 'GovernmentGuideline'
            ? '#0288d1'
            : r.sourceCategory === 'AdvertisedAskingPrice'
              ? '#ed6c02'
              : '#7b1fa2';

      const dotIcon = L.divIcon({
        className: 'record-dot-icon',
        html: `<div style="background:${color};width:14px;height:14px;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      L.marker([r.latitude, r.longitude], { icon: dotIcon })
        .addTo(map)
        .bindPopup(
          `<strong>${r.surveyNumber || r.locality}</strong><br/>` +
          `Rate: ₹${(r.normalizedRatePerCent / 100000).toFixed(2)} L/Cent (₹${r.normalizedRatePerSqFt}/sq.ft)<br/>` +
          `Category: <em>${r.sourceCategory}</em><br/>` +
          `Status: <strong>${r.verificationStatus}</strong><br/>` +
          `Date: ${new Date(r.observationDate).toLocaleDateString()}`
        );
    });
  }, [activeTab, targetLat, targetLng, radiusMeters, records]);

  const handleSelectPilotLocality = (loc: string, lat: number, lng: number) => {
    setSelectedLocality(loc);
    setTargetLat(lat);
    setTargetLng(lng);
  };

  // 5. Verification Moderation Handler
  const handleModerateStatus = async (recordId: string, newStatus: number, defaultNote: string) => {
    try {
      await api.updateVerificationStatus(recordId, newStatus, defaultNote);
      setNotification(`Record status updated successfully.`);
      setTimeout(() => setNotification(null), 4000);
      await fetchRecords();
      await fetchEstimate(targetLat, targetLng, selectedUsage);
    } catch (err: any) {
      alert(`Moderation Failed: ${err.message}`);
    }
  };

  // 6. Handle New Record Creation Submission
  const handleCreateRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingRecord(true);
    setSubmitError(null);

    try {
      await api.createLandRecord(addFormData);
      setNotification(`New land record saved to PostgreSQL database!`);
      setTimeout(() => setNotification(null), 4000);
      setIsAddModalOpen(false);
      await fetchRecords();
      await fetchEstimate(targetLat, targetLng, selectedUsage);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to create land record.');
    } finally {
      setIsSubmittingRecord(false);
    }
  };

  return (
    <div className="admin-app">
      {/* Top Brand Navigation */}
      <header className="brand-header">
        <div className="header-left">
          <div className="brand-badge">GREENART</div>
          <div>
            <h1>Greenart Properties</h1>
            <p className="header-subtitle">Land Market Rate Analyst — Administrative & Spatial Intelligence Console</p>
          </div>
        </div>
        <div className="header-right">
          <span className={`live-tag ${isApiConnected ? 'live-tag-active' : ''}`}>
            {isApiConnected ? `● Live API Connected (Port 5039)` : `⚠️ API Disconnected`}
          </span>
          <span className="live-tag">
            {health?.database?.postgisVersion ? `🐘 PostGIS Active` : `PostGIS 3.4`}
          </span>
          <span className="live-tag">🎯 Radius: 1,000m</span>
        </div>
      </header>

      {/* Global Notifications */}
      {notification && (
        <div style={{ background: '#dcfce7', color: '#166534', padding: '0.75rem 2rem', fontWeight: 600, borderBottom: '1px solid #86efac' }}>
          ✅ {notification}
        </div>
      )}

      {/* Tabs Menu */}
      <nav className="tabs-nav">
        <button className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
          🗺️ Spatial Estimation & Map
        </button>
        <button className={`tab-btn ${activeTab === 'records' ? 'active' : ''}`} onClick={() => setActiveTab('records')}>
          📋 Database Land Records ({records.length})
        </button>
        <button className={`tab-btn ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>
          📤 Batch Ingestion & Validation
        </button>
        <button className={`tab-btn ${activeTab === 'guide' ? 'active' : ''}`} onClick={() => setActiveTab('guide')}>
          📖 How It Works & Transparency Rules
        </button>
      </nav>

      {/* Main Container */}
      <main className="content-container">
        {/* ============================================================== */}
        {/* TAB 1: SPATIAL ESTIMATION & MAP */}
        {/* ============================================================== */}
        {activeTab === 'map' && (
          <div className="tab-pane">
            {/* Quick Pilot Selector */}
            <div className="card pilot-selector-card">
              <span className="selector-label">🎯 Fast Pilot Location Select:</span>
              <div className="chip-group">
                {localities.map((loc) => (
                  <button
                    key={loc.name}
                    className={`chip ${selectedLocality === loc.name ? 'chip-active' : ''}`}
                    onClick={() => handleSelectPilotLocality(loc.name, loc.latitude, loc.longitude)}
                  >
                    📍 {loc.name} ({loc.recordCount} DB records)
                  </button>
                ))}
                <button
                  className={`chip chip-warning ${selectedLocality === 'Remote Unmapped' ? 'chip-active' : ''}`}
                  onClick={() => handleSelectPilotLocality('Remote Unmapped', 11.15, 77.2)}
                >
                  ⚠️ Test Sparse Location (Lat: 11.15, Lng: 77.20)
                </button>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Land Classification:</label>
                <select
                  value={selectedUsage}
                  onChange={(e) => setSelectedUsage(e.target.value)}
                  style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Residential">Residential</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Agricultural">Agricultural</option>
                </select>
              </div>
            </div>

            <div className="grid-2col">
              {/* Left Column: Interactive Map */}
              <div className="card map-card">
                <div className="card-header">
                  <h3>Interactive 1,000m PostGIS Radius Search</h3>
                  <span className="badge badge-green">ST_DWithin Active</span>
                </div>
                <div ref={mapContainerRef} className="leaflet-map-wrapper"></div>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                  💡 <em>Click anywhere on the map to query comparable records at that exact coordinate.</em>
                </p>
                <div className="map-legend">
                  <span><strong>Legend:</strong></span>
                  <span className="legend-item"><span className="dot dot-green"></span> Verified Transaction</span>
                  <span className="legend-item"><span className="dot dot-blue"></span> Government Guideline</span>
                  <span className="legend-item"><span className="dot dot-orange"></span> Advertised Asking</span>
                  <span className="legend-item"><span className="dot dot-purple"></span> Client Research</span>
                </div>
              </div>

              {/* Right Column: Live Backend Estimation Results */}
              <div className="card results-card">
                <div className="card-header">
                  <h3>Indicative Market Valuation Engine</h3>
                  {loadingEstimate ? (
                    <span className="badge badge-light">Calculating...</span>
                  ) : estimate?.status === 'Success' ? (
                    <span className="badge badge-green">
                      Confidence: {estimate.confidence} ({estimate.comparableRecordCount} Records)
                    </span>
                  ) : (
                    <span className="badge badge-danger">Insufficient Data</span>
                  )}
                </div>

                {errorEstimate && (
                  <div className="error-banner">
                    <span>{errorEstimate}</span>
                    <button className="btn btn-sm btn-secondary" onClick={() => fetchEstimate(targetLat, targetLng, selectedUsage)}>
                      Retry
                    </button>
                  </div>
                )}

                {loadingEstimate && (
                  <div className="loading-indicator">
                    <span>Querying PostGIS spatial records within 1,000m...</span>
                  </div>
                )}

                {!loadingEstimate && estimate?.status === 'Success' && (
                  <div className="estimation-body">
                    <div className="price-hero">
                      <span className="hero-label">Estimated Indicative Market Rate (Median)</span>
                      <div className="hero-price">
                        ₹{(estimate.priceRangePerCent.medianRate / 100000).toFixed(2)} Lakhs <span className="unit">/ Cent</span>
                      </div>
                      <div className="hero-subprice">
                        Equivalent to <strong>₹{estimate.priceRangePerSqFt.medianRate.toLocaleString()}</strong> / Sq.Ft
                      </div>
                    </div>

                    <div className="stats-row">
                      <div className="stat-box">
                        <span className="stat-label">Interquartile Band (25% - 75%)</span>
                        <span className="stat-val">
                          ₹{(estimate.priceRangePerCent.percentile25 / 100000).toFixed(2)}L – ₹{(estimate.priceRangePerCent.percentile75 / 100000).toFixed(2)}L / Cent
                        </span>
                        <span className="stat-sub">
                          (₹{estimate.priceRangePerSqFt.percentile25} – ₹{estimate.priceRangePerSqFt.percentile75}/sq.ft)
                        </span>
                      </div>
                      <div className="stat-box">
                        <span className="stat-label">Full Range (Min – Max)</span>
                        <span className="stat-val">
                          ₹{(estimate.priceRangePerCent.minRate / 100000).toFixed(2)}L – ₹{(estimate.priceRangePerCent.maxRate / 100000).toFixed(2)}L / Cent
                        </span>
                        <span className="stat-sub">{estimate.comparableRecordCount} records within 1 km</span>
                      </div>
                    </div>

                    {/* Government Guideline Benchmark Box */}
                    {estimate.governmentGuidelineReference && (
                      <div className="guideline-box">
                        <div className="guideline-header">
                          🏛️ <strong>Official Government Guideline Reference</strong>
                        </div>
                        <div className="guideline-content">
                          <div>
                            Statutory Benchmark: <strong>₹{(estimate.governmentGuidelineReference.guidelineRatePerCent / 100000).toFixed(2)} L/Cent</strong> (₹{estimate.governmentGuidelineReference.guidelineRatePerSqFt}/sq.ft)
                          </div>
                          <p className="guideline-note">
                            <strong>Strict Rule:</strong> {estimate.governmentGuidelineReference.legalNotice}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="provenance-breakdown">
                      <h4>Evidence Composition Breakdown:</h4>
                      <ul>
                        {estimate.sourceBreakdown.map((s) => (
                          <li key={s.category}>
                            <span className={`tag tag-${s.category.toLowerCase()}`}>{s.category}</span>
                            <strong>{s.count}</strong> record(s)
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="disclaimer-box">
                      ⚖️ <strong>Legal Notice:</strong> {estimate.disclaimer}
                    </div>
                  </div>
                )}

                {!loadingEstimate && estimate?.status === 'InsufficientData' && (
                  <div className="insufficient-body">
                    <div className="warning-banner">
                      ⚠️ <strong>Transparent Insufficient Data Warning</strong>
                    </div>
                    <p>{estimate.message}</p>
                    <p className="rule-quote">
                      <strong>Core Quality Rule:</strong> A minimum of <strong>{estimate.minimumRequiredRecords} comparable records</strong> is strictly required to generate an honest market estimate. Greenart Properties never invents fake prices or guesses when evidence is inadequate.
                    </p>
                    <div className="recommendations-box">
                      <strong>Recommended Actions:</strong>
                      <ul>
                        {estimate.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: LAND RECORDS REGISTRY */}
        {/* ============================================================== */}
        {activeTab === 'records' && (
          <div className="tab-pane">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>PostgreSQL Land Records Registry</h3>
                  <p className="subtitle">Database records retrieved live from PostgreSQL + PostGIS on port 5433.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
                    ➕ Add Land Record
                  </button>
                  <div className="filter-controls">
                    <select value={filterLocality} onChange={(e) => setFilterLocality(e.target.value)}>
                      <option value="All">All Localities</option>
                      {localities.map((l) => (
                        <option key={l.name} value={l.name}>{l.name}</option>
                      ))}
                    </select>
                    <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
                      <option value="All">All Categories</option>
                      <option value="VerifiedTransaction">Verified Transaction</option>
                      <option value="GovernmentGuideline">Government Guideline</option>
                      <option value="AdvertisedAskingPrice">Advertised Asking Price</option>
                      <option value="ClientResearch">Client Research</option>
                    </select>
                  </div>
                </div>
              </div>

              {errorRecords && (
                <div className="error-banner">
                  <span>{errorRecords}</span>
                  <button className="btn btn-sm btn-secondary" onClick={fetchRecords}>Retry</button>
                </div>
              )}

              {loadingRecords ? (
                <div className="loading-indicator">
                  <span>Loading records from database...</span>
                </div>
              ) : records.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No land records found matching the selected filters.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Survey No / ID</th>
                        <th>Locality & Taluk</th>
                        <th>Coordinates</th>
                        <th>Usage</th>
                        <th>Area</th>
                        <th>Rate / Cent</th>
                        <th>Rate / Sq.Ft</th>
                        <th>Source Category</th>
                        <th>Status</th>
                        <th>Audit Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.surveyNumber || 'N/A'}</strong><br />
                            <small title={r.id} style={{ fontFamily: 'monospace' }}>{r.id.substring(0, 8)}...</small>
                          </td>
                          <td>{r.locality}<br /><small>{r.taluk || '-'}</small></td>
                          <td><small>{r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}</small></td>
                          <td><span className="badge badge-light">{r.landUsage}</span></td>
                          <td>{r.originalArea} {r.originalUnit}</td>
                          <td><strong>₹{(r.normalizedRatePerCent / 100000).toFixed(2)} L</strong></td>
                          <td>₹{r.normalizedRatePerSqFt.toLocaleString()}</td>
                          <td>
                            <span className={`tag tag-${r.sourceCategory.toLowerCase()}`}>
                              {r.sourceCategory}
                            </span>
                          </td>
                          <td>
                            <span className={`status-pill ${r.verificationStatus === 'Verified' ? 'status-ready' : 'status-pending'}`}>
                              {r.verificationStatus}
                            </span>
                          </td>
                          <td>
                            <div className="action-btn-group">
                              {r.verificationStatus !== 'Verified' && (
                                <button
                                  className="btn btn-sm btn-success"
                                  onClick={() => handleModerateStatus(r.id, 2, 'Verified via Admin Web Audit')}
                                  title="Audit and verify this land record"
                                >
                                  ✓ Verify
                                </button>
                              )}
                              {r.verificationStatus !== 'Rejected' && (
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleModerateStatus(r.id, 3, 'Rejected due to insufficient audit evidence')}
                                  title="Reject unverified listing"
                                >
                                  ✕ Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: BATCH DATA INGESTION */}
        {/* ============================================================== */}
        {activeTab === 'import' && (
          <div className="tab-pane">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Batch Dataset Ingestion Pipeline</h3>
                  <p className="subtitle">Upload land records with validation, PostGIS coordinate bounding, and error reporting.</p>
                </div>
              </div>

              <div className="upload-dropzone">
                <div className="upload-icon">📁</div>
                <h4>Drag & Drop CSV / Excel Spreadsheet here</h4>
                <p>Supports .csv, .xlsx (Row-by-row PostGIS bounding validation)</p>
                <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
                  Add Record Directly via Validated Form...
                </button>
              </div>

              <div className="validation-preview">
                <h4>Mandatory Validation & Security Rules:</h4>
                <div className="schema-grid">
                  <div className="schema-card">
                    <strong>1. Geographic Pinning</strong>
                    <p>Latitude [-90 to 90], Longitude [-180 to 180]. Persisted as PostGIS geography Point (SRID 4326).</p>
                  </div>
                  <div className="schema-card">
                    <strong>2. Area Unit Normalization</strong>
                    <p>Original units (Cents, Sq.Ft, Acres, Grounds) preserved and normalized automatically to ₹/Cent & ₹/Sq.Ft.</p>
                  </div>
                  <div className="schema-card">
                    <strong>3. Source Categorization</strong>
                    <p>Must be strictly tagged as GovernmentGuideline, VerifiedTransaction, AdvertisedAskingPrice, or ClientResearch.</p>
                  </div>
                  <div className="schema-card">
                    <strong>4. Default Status</strong>
                    <p>All imported rows default to "Unverified" pending administrative audit.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: HOW IT WORKS & TRANSPARENCY RULES */}
        {/* ============================================================== */}
        {activeTab === 'guide' && (
          <div className="tab-pane">
            <div className="card guide-card">
              <h3>Core Architectural & Business Principles — Greenart Properties</h3>
              <p className="lead">
                Built on the foundation: <em>"Trustworthy data, transparent estimates, security, and maintainable code are more important than adding features quickly."</em>
              </p>

              <div className="principles-grid">
                <div className="principle-item">
                  <h4>1. Target Location Independence</h4>
                  <p>
                    A user in Kanyakumari or Bengaluru can estimate land in Coimbatore or Tiruppur.
                    The application <strong>never assumes that the user's current GPS location is the property location</strong>. All searches originate from explicitly selected coordinates.
                  </p>
                </div>

                <div className="principle-item">
                  <h4>2. Strict Data Category Isolation</h4>
                  <p>
                    Official Government Guideline Values, Verified Registered Transactions, Advertised Asking Prices, and Client Research are <strong>never commingled or misrepresented</strong>. A statutory guideline value is never shown as a completed market sale.
                  </p>
                </div>

                <div className="principle-item">
                  <h4>3. Transparent Rule-Based Estimation</h4>
                  <p>
                    Estimates are calculated using a transparent, explainable statistical method (Median and Interquartile Range) rather than black-box machine learning models. Every estimate displays supporting record count, dates, and source composition.
                  </p>
                </div>

                <div className="principle-item">
                  <h4>4. Refusal to Guess (Insufficient Data)</h4>
                  <p>
                    When fewer than 3 comparable records exist within the 1,000-meter radius, the system refuses to output a speculative price range. It clearly explains that reliable data is insufficient in that sector.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* ADD NEW LAND RECORD MODAL */}
      {/* ============================================================== */}
      {isAddModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>➕ Add New Land Price Record</h3>
              <button className="modal-close-btn" onClick={() => setIsAddModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleCreateRecordSubmit}>
              <div className="modal-body">
                {submitError && (
                  <div className="error-banner">
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Locality *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={addFormData.locality}
                      onChange={(e) => setAddFormData({ ...addFormData, locality: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Taluk</label>
                    <input
                      type="text"
                      className="form-control"
                      value={addFormData.taluk || ''}
                      onChange={(e) => setAddFormData({ ...addFormData, taluk: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Survey Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. SF 145/2"
                      value={addFormData.surveyNumber || ''}
                      onChange={(e) => setAddFormData({ ...addFormData, surveyNumber: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Street / Landmark</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Near Panchayat Office"
                      value={addFormData.streetOrLandmark || ''}
                      onChange={(e) => setAddFormData({ ...addFormData, streetOrLandmark: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Latitude * (-90 to 90)</label>
                    <input
                      type="number"
                      step="0.000001"
                      className="form-control"
                      value={addFormData.latitude}
                      onChange={(e) => setAddFormData({ ...addFormData, latitude: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Longitude * (-180 to 180)</label>
                    <input
                      type="number"
                      step="0.000001"
                      className="form-control"
                      value={addFormData.longitude}
                      onChange={(e) => setAddFormData({ ...addFormData, longitude: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Land Usage *</label>
                    <select
                      className="form-control"
                      value={addFormData.landUsage}
                      onChange={(e) => setAddFormData({ ...addFormData, landUsage: parseInt(e.target.value) })}
                    >
                      <option value={1}>Residential</option>
                      <option value={2}>Commercial</option>
                      <option value={3}>Agricultural Wet</option>
                      <option value={4}>Agricultural Dry</option>
                      <option value={5}>Industrial</option>
                      <option value={6}>Mixed Use</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Source Category *</label>
                    <select
                      className="form-control"
                      value={addFormData.sourceCategory}
                      onChange={(e) => setAddFormData({ ...addFormData, sourceCategory: parseInt(e.target.value) })}
                    >
                      <option value={2}>Verified Transaction (Deed)</option>
                      <option value={3}>Advertised Asking Price</option>
                      <option value={4}>Client Research</option>
                      <option value={1}>Government Guideline (Benchmark)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Area *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={addFormData.area}
                      onChange={(e) => setAddFormData({ ...addFormData, area: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Area Unit *</label>
                    <select
                      className="form-control"
                      value={addFormData.unit}
                      onChange={(e) => setAddFormData({ ...addFormData, unit: parseInt(e.target.value) })}
                    >
                      <option value={2}>Cent (435.6 sq.ft)</option>
                      <option value={1}>Sq.Ft</option>
                      <option value={3}>Acre (100 Cents)</option>
                      <option value={4}>Ground (2400 sq.ft)</option>
                      <option value={5}>Kuzhi (144 sq.ft)</option>
                      <option value={6}>Sq.Meter</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Original Total Price (₹) *</label>
                  <input
                    type="number"
                    step="1000"
                    className="form-control"
                    placeholder="e.g. 3500000"
                    value={addFormData.price}
                    onChange={(e) => setAddFormData({ ...addFormData, price: parseFloat(e.target.value) || 0 })}
                    required
                  />
                  <small style={{ color: '#64748b' }}>
                    Rate per Cent will be calculated automatically by the server.
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label">Source Reference / Document ID</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. SRO Sulur Doc 4501/2024 or Classifieds #KP-102"
                    value={addFormData.sourceReference || ''}
                    onChange={(e) => setAddFormData({ ...addFormData, sourceReference: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Audit Notes</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="e.g. Corner plot facing 30ft road with clear title."
                    value={addFormData.notes || ''}
                    onChange={(e) => setAddFormData({ ...addFormData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingRecord}>
                  {isSubmittingRecord ? 'Saving to Database...' : 'Save to PostgreSQL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="admin-footer">
        <div>Greenart Properties &copy; 2026. Land Market Rate Analyst Platform.</div>
        <div>
          API: <code>{isApiConnected ? 'Live on http://localhost:5039' : 'Disconnected'}</code> &bull; Database:{' '}
          <code>PostgreSQL 16 + PostGIS on port 5433</code>
        </div>
      </footer>
    </div>
  );
};

export default App;
